-- ============================================================
-- 093 — الضريبة على الفاتورة + رقم فاتورة حقيقي
-- ============================================================
--
-- كيرو اتسأل بالظبط: "مطلوب منك فاتورة إلكترونية للمصلحة، ولا
-- اللي محتاجه إن الضريبة تبان في الفاتورة وبس؟" وجاوب:
-- **"عايزها في الفاتورة بس."**
--
-- الإجابة دي هي اللي بتحدد حجم الشغل كله. الربط بمنظومة الفاتورة
-- الإلكترونية (ETA) شهور: تسجيل، وشهادة توقيع إلكتروني، وربط API،
-- واختبارات مع المصلحة. اللي هنا يوم شغل.
--
-- ------------------------------------------------------------
-- القرار الأهم: الأسعار **شاملة** الضريبة
-- ------------------------------------------------------------
--
-- ده مش تفصيلة - ده اللي بيحدد هل الزبون هيدفع نفس الرقم ولا لأ.
--
--   شاملة  (المعمول بيه هنا): اللاتيه بـ٦٠ ج، جواها ٧.٣٧ ضريبة.
--                              الزبون بيدفع ٦٠ زي ما هو.
--   غير شاملة:                 اللاتيه بـ٦٠ + ١٤٪ = ٦٨.٤٠.
--                              **كل الأسعار في المنيو بتزيد ١٤٪.**
--
-- كافيه بيحط سعر على المنيو والزبون بيدفعه - يبقى شاملة. وde
-- كمان الاختيار الآمن تقنيًا: الضريبة بتتحسب **من الإجمالي
-- المسجّل**، يعني `record_sale` مابتتغيّرش في حساب الفلوس، ولا
-- تقرير واحد بيتغيّر رقمه، ولا `sale_items.cost` ولا الأرباح.
-- الضريبة سطر على الورقة، مش رقم جديد في القاعدة.
--
-- لو احتجنا "غير شاملة" بعدين، دي فيتشر تانية بالكامل وبتلمس
-- أخطر دالة في النظام. مانعملهاش قبل ما محل حقيقي يطلبها.
--
-- ------------------------------------------------------------
-- ورقم الفاتورة
-- ------------------------------------------------------------
--
-- الفاتورة الضريبية لازم يكون ليها **رقم مسلسل**. اللي كان عندنا
-- `id` من نوع uuid - ماينفعش يتكتب على ورقة ولا يتقال في تليفون.
--
-- الرقم بيتاخد من عدّاد على صف المحل نفسه (`next_invoice_number`)
-- جوه نفس المعاملة بتاعة البيعة. وde مقصود بدل `sequence`:
--
--   * العدّاد بيترجع لو البيعة فشلت → **مفيش أرقام ضايعة**.
--     الـsequence مابترجعش، فأي بيعة اترفضت كانت هتاكل رقم
--     وتسيب فجوة في دفتر الفواتير.
--   * القفل على صف المحل بيخلّي بيعتين في نفس اللحظة ياخدوا
--     رقمين مختلفين - مش نفس الرقم.
--
-- التسلسل **لكل محل لوحده**: كل واحد بيبدأ من ١.

-- ------------------------------------------------------------
-- ١. أعمدة الإعدادات
-- ------------------------------------------------------------

alter table public.businesses
  add column if not exists tax_enabled          boolean not null default false,
  add column if not exists tax_rate             numeric(5,2) not null default 14,
  add column if not exists tax_number           text,
  add column if not exists next_invoice_number  bigint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_tax_rate_sane'
  ) then
    alter table public.businesses
      add constraint businesses_tax_rate_sane
      check (tax_rate >= 0 and tax_rate <= 100);
  end if;
end $$;

alter table public.sales
  add column if not exists invoice_number bigint,
  add column if not exists tax_rate       numeric(5,2);

-- ------------------------------------------------------------
-- ٢. الصلاحيات — دي الخطوة اللي بتتنسي وبتوقّع البرنامج
-- ------------------------------------------------------------
--
-- `businesses` و`sales` الاتنين عليهم صلاحيات **على مستوى العمود**
-- (نتيجة إخفاء `buy_price` وغيره). ومعنى ده إن أي عمود جديد
-- **ممنوع افتراضيًا** لحد ما يتداله grant بالاسم.
--
-- وde مش كلام نظري: ميجريشن ٠٩١ ضافت `is_ingredient` من غير grant،
-- و`getActiveItems` بتفلتر عليه - يعني **شاشة البيع كلها** كانت
-- هتقع. اتلقت قبل الرفع بشعرة.
--
-- وهنا أخطر، لأن `getBusiness` في الكود بتعمل `select("*")`:
-- عمود واحد من غير grant = `permission denied for table businesses`
-- = **البرنامج مابيفتحش من أصله**.
--
-- عشان كده `next_invoice_number` بياخد SELECT (عدّاد مش سر)،
-- بس **مابياخدش UPDATE ولا INSERT**: محدش من المتصفح يقدر يرجّع
-- ترقيم الفواتير لورا. `record_sale` بتوصله لأنها SECURITY DEFINER.

grant select (tax_enabled, tax_rate, tax_number, next_invoice_number)
  on public.businesses to authenticated;

grant update (tax_enabled, tax_rate, tax_number)
  on public.businesses to authenticated;

grant insert (tax_enabled, tax_rate, tax_number)
  on public.businesses to authenticated;

grant select (invoice_number, tax_rate) on public.sales to authenticated;

-- الكتابة في العمودين دول من `record_sale` بس. مفيش grant.

-- ------------------------------------------------------------
-- ٣. ترقيم الفواتير القديمة
-- ------------------------------------------------------------
--
-- كل محل بياخد ترتيبه من أول فاتورة ليه. `tax_rate` بتفضل null
-- في القديم - وde صح: الضريبة ماكانتش مفعّلة وقتها، وكتابة ١٤٪
-- عليها كان هيبقى **اختراع بيانات**.

with numbered as (
  select id,
         row_number() over (partition by business_id order by created_at, id) as n
  from public.sales
  where invoice_number is null
)
update public.sales s
   set invoice_number = numbered.n
  from numbered
 where s.id = numbered.id;

update public.businesses b
   set next_invoice_number = coalesce(
         (select max(s.invoice_number) + 1 from public.sales s
           where s.business_id = b.id), 1);

-- ------------------------------------------------------------
-- ٤. record_sale بتاخد رقم وتصوّر نسبة الضريبة
-- ------------------------------------------------------------
--
-- **نسبة الضريبة بتتخزّن على الفاتورة نفسها** مش بتتقري من
-- الإعدادات وقت العرض. لو النسبة اتغيّرت السنة الجاية، الفواتير
-- القديمة تفضل بنسبتها - وde الفرق بين دفتر فواتير صح ودفتر
-- بيتزوّر بأثر رجعي كل ما حد يغيّر إعداد.

create or replace function public.record_sale(
    p_shift_id      uuid,
    p_warehouse_id  uuid,
    p_payment_method text,
    p_price_tier    integer,
    p_discount      numeric,
    p_customer_id   uuid,
    p_lines         jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_business  uuid := get_my_business_id();
    v_user      uuid := my_user_id();
    v_tier      int  := coalesce(p_price_tier, 1);
    v_discount  numeric := coalesce(p_discount, 0);
    v_subtotal  numeric := 0;
    v_max_pct   numeric;
    v_sale      uuid;
    v_line      jsonb;
    v_item_id   uuid;
    v_qty       numeric;
    v_price     numeric;
    v_item      record;
    v_ids       uuid[]    := '{}';
    v_qtys      numeric[] := '{}';
    v_prices    numeric[] := '{}';
    v_invoice   bigint;
    v_tax_rate  numeric;
    i           int;
begin
    if v_business is null or v_user is null then
        raise exception 'غير مصرّح';
    end if;

    if not has_permission('sell') then
        raise exception 'مش مسموح تبيع';
    end if;

    if not business_is_active(v_business) then
        raise exception 'الاشتراك خلص - جدّد عشان تكمّل بيع';
    end if;

    if p_lines is null or jsonb_typeof(p_lines) <> 'array'
       or jsonb_array_length(p_lines) = 0 then
        raise exception 'الفاتورة فاضية';
    end if;

    if v_tier not in (1, 2, 3) then
        raise exception 'تسعيرة غير صالحة';
    end if;

    if p_payment_method is null
       or p_payment_method not in ('cash', 'vodafone_cash', 'instapay', 'credit') then
        raise exception 'طريقة دفع غير صالحة';
    end if;

    if p_payment_method = 'credit' and p_customer_id is null then
        raise exception 'اختار العميل الأول عشان تبيع على الحساب';
    end if;

    if p_customer_id is not null and not exists (
        select 1 from customers
        where id = p_customer_id and business_id = v_business
    ) then
        raise exception 'العميل مش من نشاطك';
    end if;

    if p_shift_id is not null and not exists (
        select 1 from shifts
        where id = p_shift_id and business_id = v_business
    ) then
        raise exception 'الشيفت مش من نشاطك';
    end if;

    for v_line in select * from jsonb_array_elements(p_lines)
    loop
        v_item_id := (v_line ->> 'item_id')::uuid;
        v_qty     := (v_line ->> 'quantity')::numeric;

        if v_item_id is null or v_qty is null or v_qty <= 0 then
            raise exception 'سطر غير صالح في الفاتورة';
        end if;

        select sell_price, sell_price_2, sell_price_3, active
        into v_item
        from items
        where id = v_item_id and business_id = v_business;

        if not found then
            raise exception 'صنف مش من نشاطك';
        end if;

        if not v_item.active then
            raise exception 'صنف موقوف مينفعش يتباع';
        end if;

        v_price := case v_tier
            when 2 then coalesce(v_item.sell_price_2, v_item.sell_price)
            when 3 then coalesce(v_item.sell_price_3, v_item.sell_price)
            else v_item.sell_price
        end;

        if v_price is null or v_price < 0 then
            raise exception 'الصنف مالوش سعر';
        end if;

        v_ids    := v_ids    || v_item_id;
        v_qtys   := v_qtys   || v_qty;
        v_prices := v_prices || v_price;

        v_subtotal := v_subtotal + (v_qty * v_price);
    end loop;

    if v_discount < 0 then
        raise exception 'الخصم مينفعش يكون بالسالب';
    end if;

    if v_discount > 0 then
        if not has_permission('give_discount') then
            raise exception 'مش مسموحلك تدي خصم';
        end if;

        if v_discount > v_subtotal then
            raise exception 'الخصم أكبر من قيمة الفاتورة';
        end if;

        select max_discount_percent into v_max_pct
        from businesses where id = v_business;

        if v_max_pct is not null
           and v_discount > v_subtotal * v_max_pct / 100 then
            raise exception 'الخصم أكبر من الحد المسموح: % بالمية', v_max_pct;
        end if;
    end if;

    -- الرقم والنسبة في نداء واحد. الـUPDATE بياخد قفل على صف
    -- المحل، فبيعتين في نفس اللحظة بيتصفّوا ورا بعض بدل ما ياخدوا
    -- نفس الرقم. و`returning` بترجّع القيمة الجديدة، فاللي
    -- اتخصّص للفاتورة دي هو اللي قبلها.
    update businesses
       set next_invoice_number = next_invoice_number + 1
     where id = v_business
    returning next_invoice_number - 1,
              case when tax_enabled then tax_rate else null end
      into v_invoice, v_tax_rate;

    insert into sales (
        business_id, created_by, shift_id, payment_method,
        total, discount_amount, price_tier, customer_id,
        invoice_number, tax_rate
    )
    values (
        v_business, v_user, p_shift_id, p_payment_method,
        v_subtotal - v_discount, v_discount, v_tier, p_customer_id,
        v_invoice, v_tax_rate
    )
    returning id into v_sale;

    for i in 1 .. array_length(v_ids, 1)
    loop
        perform sell_line(
            v_sale, v_ids[i], v_qtys[i], p_warehouse_id,
            v_prices[i], v_qtys[i] * v_prices[i]
        );
    end loop;

    return v_sale;
end;
$function$;

-- ------------------------------------------------------------
-- ٥. الضريبة المحصّلة في فترة
-- ------------------------------------------------------------
--
-- الرقم اللي بيتحط في الإقرار. بيتجمّع **في القاعدة** بنفس منطق
-- `profit_by_item` (ميجريشن ٠٨٢): لو اتحسب في المتصفح، اللي مالوش
-- `view_reports` كان هيشوف مجموع بيعاته هو ويفتكره رقم المحل -
-- ورقم ناقص أخطر من رسالة "ممنوع".
--
-- كل فاتورة بتتحسب **بنسبتها هي** المتخزّنة عليها. والفواتير
-- اللي الضريبة ماكانتش مفعّلة وقتها بتتجاهل.

create or replace function public.tax_summary(p_from date, p_to date)
returns table (
    net_total   numeric,
    tax_total   numeric,
    gross_total numeric,
    sale_count  bigint
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_business uuid := get_my_business_id();
begin
    if v_business is null then
        raise exception 'غير مصرّح';
    end if;

    if not has_read_permission('view_reports') then
        raise exception 'مش مسموحلك تشوف التقارير';
    end if;

    return query
    select
        round(coalesce(sum(s.total * 100 / (100 + s.tax_rate)), 0), 2),
        round(coalesce(sum(s.total * s.tax_rate / (100 + s.tax_rate)), 0), 2),
        round(coalesce(sum(s.total), 0), 2),
        count(*)
    from sales s
    where s.business_id = v_business
      and s.tax_rate is not null
      and s.tax_rate > 0
      and s.created_at >= p_from::timestamptz
      and s.created_at < (p_to + 1)::timestamptz;
end;
$$;

revoke all on function public.tax_summary(date, date) from public, anon;
grant execute on function public.tax_summary(date, date) to authenticated;

notify pgrst, 'reload schema';
