-- 075 - الفاتورة بقت عملية واحدة، والسعر بيتحدد في القاعدة مش في
--       المتصفح.
--
-- ============================================================
-- الثغرة: الكاشير يبيع بأي سعر يختاره
-- ============================================================
--
-- سعر البيع كان بيتحسب في المتصفح وبيتبعت لـ`sell_line` كرقم:
--
--   p_unit_price: priceForTier(line.item, priceTier)
--   p_total:      line.total
--
-- وقاعدة البيانات كانت بتكتب الرقم زي ما هو من غير أي سؤال. يعني
-- أي حد يفتح أدوات المطوّر (أو يبعت طلب من برة الصفحة أصلًا) يقدر
-- يبيع صنف بـ٢٣٠ جنيه بجنيه واحد.
--
-- **اتجرّب بحساب كاشير حقيقي وعدّى:**
--
--   sale_total  1.00     ← المفروض 230
--   unit_price  1.00
--   cost        85.00    ← الدفتر بيقول خسرت ٨٤ جنيه
--   real_price  230.00
--
-- البضاعة خرجت من الرف، والفلوس اللي في الدرج ٢٢٩ أقل من اللازم،
-- والتقرير بيقول "بيعة عادية". ده أخطر من قراءة التكلفة: ده سرقة
-- مباشرة من الدرج، ومحصّنة بورق.
--
-- ونفس الحكاية في الخصم: `max_discount_percent` و صلاحية
-- `give_discount` **الاتنين ماكانوش متطبّقين في أي مكان غير الواجهة**.
-- خصم ١٠٠٪ كان يعدّي.
--
-- نفس درس الثغرة الأصلية في AGENTS §1، بس على الفلوس مباشرة:
-- إخفاء حقل في الواجهة مش تأمين. والقاعدة العامة اللي طلعت منها:
-- **أي رقم فلوس المتصفح يقدر يسمّيه، هو رقم يقدر يختاره.**
-- (نفس القاعدة المكتوبة في §3 عن endpoints الدفع - كانت متطبّقة على
-- فاتورة الاشتراك وماتطبقتش على فاتورة الزبون.)
--
-- ============================================================
-- والمشكلة التانية: الفاتورة ماكانتش عملية واحدة
-- ============================================================
--
-- (البند رقم ٥ في "اللي لسه ناقص")
--
-- كل سطر كان بينداله `sell_line` لوحده. لو النت قطع في نص فاتورة
-- من خمس أصناف، التلاتة الأولانيين بيبقوا اتسجّلوا واتخصموا من
-- المخزون، والفاتورة نفسها موجودة بإجمالي غلط. والكاشير يعيد البيع
-- فتتخصم البضاعة مرتين.
--
-- ============================================================
-- الحل: دالة واحدة
-- ============================================================
--
-- `record_sale` بتاخد **الأصناف والكميات بس** - مفيش أسعار. بتجيب
-- السعر من `items` حسب التسعيرة، وتحسب الإجمالي، وتتحقق من الخصم،
-- وتكتب الفاتورة وكل سطورها. دالة واحدة = معاملة واحدة: يا تعدّي
-- كلها يا مفيش حاجة تحصل.
--
-- `sell_line` سايباها زي ما هي - مستعملة من `record_sale` نفسها،
-- ومش هنكسر أي نسخة قديمة شغالة وقت الرفع.

create or replace function public.record_sale(
    p_shift_id       uuid,
    p_warehouse_id   uuid,
    p_payment_method text,
    p_price_tier     int,
    p_discount       numeric,
    p_customer_id    uuid,
    p_lines          jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
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
    i           int;
begin
    if v_business is null or v_user is null then
        raise exception 'غير مصرّح';
    end if;

    if not has_permission('sell') then
        raise exception 'مش مسموح تبيع';
    end if;

    -- الدالة دي SECURITY DEFINER، يعني الـRLS مش بتنطبق عليها -
    -- وفيها policy اسمها require_active_subscription على sales
    -- وsale_items كانت هي اللي بتقفل البيع على محل خلص اشتراكه.
    -- من غير السطر ده، الإصلاح ده كان هيفتح البيع للمحلات الموقوفة.
    -- (نفس درس §1: الـview اللي بتتخطى الـRLS بتتخطاها كلها، مش
    -- الحتة اللي إنت قاصدها بس. وde ينطبق على الدوال زي الـviews.)
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

    -- ===== المجموع بيتحسب هنا من أسعار الجدول =====
    --
    -- ده قلب الإصلاح. المتصفح بيقول "اتنين من الصنف ده" وبس. السعر
    -- بيتقرا من items جوه نفس المعاملة، فمفيش رقم جاي من برة يقدر
    -- يغيّر قيمة الفاتورة.
    --
    -- الأسعار بتتخزّن في مصفوفات عشان تتقرا **مرة واحدة**. لو قريناها
    -- تاني وقت الكتابة، تعديل سعر من المالك في نفس اللحظة يخلي
    -- إجمالي الفاتورة مش مساوي لمجموع سطورها.
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

        -- نفس منطق lib/priceTier.ts: التسعيرة الناقصة بترجع للأولى.
        -- لو الاتنين اتفرقوا، الشاشة هتقول رقم والفاتورة رقم تاني -
        -- عشان كده المنطق مكرر هنا عن قصد، والتعليق ده هو الرباط.
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

    -- ===== الخصم =====
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

        -- null معناها "المالك ماحطش حد" - مش "مفيش خصم مسموح".
        if v_max_pct is not null
           and v_discount > v_subtotal * v_max_pct / 100 then
            raise exception 'الخصم أكبر من الحد المسموح: % بالمية', v_max_pct;
        end if;
    end if;

    insert into sales (
        business_id, created_by, shift_id, payment_method,
        total, discount_amount, price_tier, customer_id
    )
    values (
        v_business, v_user, p_shift_id, p_payment_method,
        v_subtotal - v_discount, v_discount, v_tier, p_customer_id
    )
    returning id into v_sale;

    -- السطور. sell_line بتسحب المخزون وتحسب التكلفة وتكتب السطر -
    -- وكل ده جوه نفس المعاملة بتاعة record_sale، فلو سطر وقع
    -- الفاتورة كلها بترجع ومفيش بضاعة بتتخصم.
    for i in 1 .. array_length(v_ids, 1)
    loop
        perform sell_line(
            v_sale, v_ids[i], v_qtys[i], p_warehouse_id,
            v_prices[i], v_qtys[i] * v_prices[i]
        );
    end loop;

    return v_sale;
end;
$$;

comment on function public.record_sale(uuid, uuid, text, int, numeric, uuid, jsonb) is
  'بتكتب الفاتورة وكل سطورها في معاملة واحدة. بتاخد أصناف وكميات بس - السعر بيتقرا من items، فالمتصفح مايقدرش يسمّي سعر ولا إجمالي. الخصم بيتحقق من صلاحية give_discount ومن max_discount_percent.';

revoke all on function
  public.record_sale(uuid, uuid, text, int, numeric, uuid, jsonb)
  from public, anon;

grant execute on function
  public.record_sale(uuid, uuid, text, int, numeric, uuid, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
