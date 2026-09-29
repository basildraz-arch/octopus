-- 100 - المخزون الناقص بيسأل الكاشير، مابيوقّفهوش.
--
-- ============================================================
-- المشكلة
-- ============================================================
--
-- `sell_line` كانت بترفع خطأ لما الكمية المطلوبة أكبر من المسجّل:
--
--     raise exception 'خلص %: محتاج % والمتاح %'
--
-- وde صح حسابيًا وغلط في محل حقيقي. الشوال السكر اللي اتشترى
-- امبارح ومحدش سجّله **موجود في المطبخ**؛ اللي ناقص هو التسجيل مش
-- الخامة. والبرنامج كان بيقف في وش الزبون ويقول "السكر خلص" وصاحب
-- المحل شايفه بعينه.
--
-- ودي بالظبط تجربة بتخلّي الواحد يقفل البرنامج ويرجع للورقة - لأن
-- الورقة عمرها ما رفضت تكتب.
--
-- والحل **مش** إننا نلغي التحقق. الحل إن القرار يرجع للي واقف على
-- الكاشير: البرنامج يقوله "السكر ناقص ٠.٢ كيلو في المسجّل - أكمّل؟"
-- وهو يشوف بعينه ويقرر. باسل اختار ده بنفسه من تلات اختيارات.
--
-- ============================================================
-- ليه المخزون مابينزلش بالسالب
-- ============================================================
--
-- الحل الأنضف نظريًا إن الدفعة تنزل بالسالب فيبان إن فيه فرق. بس
-- `stock_batches_positive` بتقول `remaining_quantity >= 0`، والقيد
-- ده **حاجة كويسة مش عقبة** - هو اللي بيمنع أن غلطة في الكود
-- تخلّي المخزون رقم مالوش معنى.
--
-- فبناخد المتاح لحد الصفر، والفرق بيبان إن الخامة على **صفر** وفي
-- نفس الوقت البيع ماشي - وde معناه رسالة واحدة واضحة: "سجّل
-- مشترياتك". وشاشة الأصناف بتعد "كام صنف قليل" أصلًا.
--
-- ============================================================
-- والتكلفة؟
-- ============================================================
--
-- لو خصمنا المتاح بس، الجزء الناقص تكلفته صفر - والأرباح تطلع أعلى
-- من الحقيقة. ودي نفس المشكلة اللي بنصلّحها (كيرو كان بيحسب أرباحه
-- على أسعار شرا تخمينية).
--
-- فالجزء الناقص بياخد **سعر آخر دفعة اتشترت من الخامة دي**. ده
-- تقدير، مش رقم مؤكد - بس هو أقرب حاجة عندنا، وأصدق بكتير من صفر.
--
-- ============================================================
-- التوافق مع النسخة المنشورة
-- ============================================================
--
-- `p_allow_short` جاي **بقيمة افتراضية `false`**، والمتصفح بينادي
-- الدالة بأسماء الوسائط عن طريق PostgREST. يعني النسخة المنشورة
-- دلوقتي (اللي بتبعت ٧ وسائط) بتفضل شغالة حرف بحرف وبنفس السلوك
-- القديم بالظبط - وde مقصود: الميجريشن بيتطبّق على قاعدة عليها
-- محل شغال.
--
-- ولازم `drop` قبل `create` مش `create or replace`: وسيط جديد
-- معناه **بصمة جديدة**، فالنسختين بيتواجدوا مع بعض وPostgREST
-- بيرفض النداء لأنه مش عارف يختار أنهي واحدة.

-- ============================================================
-- ١) قايمة النواقص - قبل البيع، للعرض بس
-- ============================================================
--
-- الدالة دي **مابتغيّرش حاجة**. شاشة الكاشير بتنادي عليها قبل ما
-- تحفظ الفاتورة، وبترجع الخامات اللي المسجّل منها أقل من المطلوب،
-- عشان تعرض السؤال. والتحقق الحقيقي فاضل جوه `sell_line` - دي
-- للعرض، مش للحماية (درس §٦: التحقق المكرر بيفترق مع الوقت،
-- فالمرجع الوحيد هو القاعدة).
--
-- بتجمّع الكميات **على مستوى الفاتورة كلها**: لاتيه وكابتشينو
-- الاتنين بياخدوا لبن، فلازم اللبن يتحسب مرة واحدة على المجموع.
-- من غير الجمع ده كل سطر كان هيتحقق لوحده ويعدّي، وتقع في
-- `sell_line` بعد ما الفاتورة بدأت.

create or replace function public.sale_stock_shortages(
    p_warehouse_id uuid,
    p_lines        jsonb
)
returns table (
    item_name text,
    unit      text,
    needed    numeric,
    available numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
    v_business uuid := get_my_business_id();
begin
    if v_business is null then
        raise exception 'غير مصرّح';
    end if;

    if not has_permission('sell') then
        raise exception 'مش مسموح تبيع';
    end if;

    -- مخزن مش من النشاط (أو فاضي): مابنقولش "كل حاجة ناقصة".
    -- `sell_line` هي اللي بترفع الخطأ الصح في الحالة دي، والدالة دي
    -- مش مكانها.
    if p_warehouse_id is null or not exists (
        select 1 from warehouses
        where id = p_warehouse_id and business_id = v_business
    ) then
        return;
    end if;

    return query
    with lines as (
        select (l ->> 'item_id')::uuid    as item_id,
               (l ->> 'quantity')::numeric as quantity
        from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
        where (l ->> 'item_id') is not null
          and (l ->> 'quantity') is not null
    ),

    -- الصنف اللي له وصفة: اللي بينقص هو مكوّناته، مش هو.
    -- الصنف اللي مالوش وصفة وله مخزون: بينقص هو نفسه.
    -- **ونفس الترتيب بالظبط في `sell_line`** - الوصفة بتغلب المخزون.
    needs as (
        select ic.component_item_id as item_id,
               sum(li.quantity * ic.quantity) as needed
        from lines li
        join item_components ic
          on ic.parent_item_id = li.item_id
         and ic.business_id = v_business
        group by ic.component_item_id

        union all

        select li.item_id, sum(li.quantity)
        from lines li
        join items i
          on i.id = li.item_id
         and i.business_id = v_business
        where i.has_stock
          and not exists (
              select 1 from item_components ic
              where ic.parent_item_id = li.item_id
                and ic.business_id = v_business
          )
        group by li.item_id
    ),

    totals as (
        select item_id, sum(needed) as needed
        from needs
        group by item_id
    ),

    stock as (
        select sb.item_id, sum(sb.remaining_quantity) as available
        from stock_batches sb
        where sb.warehouse_id = p_warehouse_id
          and sb.business_id  = v_business
          and sb.remaining_quantity > 0
        group by sb.item_id
    )

    select i.name::text,
           i.unit::text,
           t.needed,
           coalesce(s.available, 0)
    from totals t
    join items i on i.id = t.item_id
    left join stock s on s.item_id = t.item_id
    where coalesce(s.available, 0) < t.needed
    order by i.name;
end;
$$;

comment on function public.sale_stock_shortages(uuid, jsonb) is
  'قبل البيع: الخامات اللي المسجّل منها أقل من المطلوب. للعرض بس - التحقق الحقيقي في sell_line.';

revoke all on function public.sale_stock_shortages(uuid, jsonb)
  from public, anon;

grant execute on function public.sale_stock_shortages(uuid, jsonb)
  to authenticated, service_role;


-- ============================================================
-- ٢) sell_line - بتاخد المتاح وتكمّل لو مسموح
-- ============================================================

drop function if exists public.sell_line(uuid, uuid, numeric, uuid, numeric, numeric);

create function public.sell_line(
    p_sale_id      uuid,
    p_item_id      uuid,
    p_quantity     numeric,
    p_warehouse_id uuid,
    p_unit_price   numeric,
    p_total        numeric,
    p_allow_short  boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_business   uuid := get_my_business_id();
    v_remaining  numeric;
    v_take       numeric;
    v_available  numeric;
    v_cost       numeric := 0;
    v_stock      numeric := 0;
    v_value      numeric := 0;
    v_has_stock  boolean;
    v_has_recipe boolean;
    v_needed     numeric;
    v_short      numeric;
    v_ref_price  numeric;
    b record;
    c record;
begin
    if v_business is null then
        raise exception 'غير مصرّح';
    end if;

    if not has_permission('sell') then
        raise exception 'مش مسموح تبيع';
    end if;

    if not exists (
        select 1 from sales
        where id = p_sale_id and business_id = v_business
    ) then
        raise exception 'الفاتورة مش من نشاطك';
    end if;

    select has_stock into v_has_stock
    from items where id = p_item_id and business_id = v_business;

    if not found then
        raise exception 'الصنف مش من نشاطك';
    end if;

    if p_quantity is null or p_quantity <= 0 then
        raise exception 'الكمية لازم تكون أكبر من صفر';
    end if;

    select exists (
        select 1 from item_components
        where parent_item_id = p_item_id and business_id = v_business
    ) into v_has_recipe;

    if v_has_recipe then
        if not exists (
            select 1 from warehouses
            where id = p_warehouse_id and business_id = v_business
        ) then
            raise exception 'المخزن مش من نشاطك';
        end if;

        for c in
            select ic.component_item_id, ic.quantity, i.name
            from item_components ic
            join items i on i.id = ic.component_item_id
            where ic.parent_item_id = p_item_id
              and ic.business_id = v_business
            order by i.name
        loop
            v_needed := p_quantity * c.quantity;

            select coalesce(sum(remaining_quantity), 0) into v_available
            from stock_batches
            where item_id = c.component_item_id
              and warehouse_id = p_warehouse_id
              and business_id = v_business
              and remaining_quantity > 0;

            v_short := 0;

            if v_available < v_needed then
                -- الرفض فاضل هو السلوك الافتراضي. اللي بيغيّره هو
                -- تأكيد صريح من اللي واقف على الكاشير، بيوصل هنا
                -- في `p_allow_short` - مش إعداد مخفي ولا استثناء
                -- دايم.
                if not p_allow_short then
                    raise exception 'خلص %: محتاج % والمتاح %',
                        c.name, v_needed, v_available;
                end if;

                v_short  := v_needed - v_available;
                v_needed := v_available;
            end if;

            v_remaining := v_needed;

            for b in
                select id, remaining_quantity, buy_price
                from stock_batches
                where item_id = c.component_item_id
                  and warehouse_id = p_warehouse_id
                  and business_id = v_business
                  and remaining_quantity > 0
                order by created_at
                for update
            loop
                exit when v_remaining <= 0;

                v_take := least(b.remaining_quantity, v_remaining);

                update stock_batches
                set remaining_quantity = remaining_quantity - v_take
                where id = b.id;

                v_cost := v_cost + v_take * b.buy_price;
                v_remaining := v_remaining - v_take;
            end loop;

            -- الجزء اللي مالوش دفعة مسجّلة: تكلفته بسعر آخر دفعة
            -- اتشترت من الخامة دي. تقدير - بس صفر كان هيكدب في
            -- تقرير الأرباح، وde أسوأ.
            if v_short > 0 then
                select buy_price into v_ref_price
                from stock_batches
                where item_id = c.component_item_id
                  and business_id = v_business
                order by created_at desc
                limit 1;

                v_cost := v_cost + v_short * coalesce(v_ref_price, 0);
            end if;

            update items set updated_at = now()
            where id = c.component_item_id and business_id = v_business;
        end loop;

    elsif v_has_stock then
        if not exists (
            select 1 from warehouses
            where id = p_warehouse_id and business_id = v_business
        ) then
            raise exception 'المخزن مش من نشاطك';
        end if;

        select coalesce(sum(remaining_quantity), 0) into v_available
        from stock_batches
        where item_id = p_item_id
          and warehouse_id = p_warehouse_id
          and business_id = v_business
          and remaining_quantity > 0;

        v_needed := p_quantity;
        v_short  := 0;

        if v_available < v_needed then
            -- نفس المنطق للبضاعة الجاهزة: الكانز اللي على الرف
            -- ومحدش سجّله موجود فعلًا. سلوكين مختلفين لنفس الحالة
            -- كان هيبقى مصدر لخبطة لوحده.
            if not p_allow_short then
                raise exception 'الكمية المطلوبة أكبر من المخزون المتاح فعليًا';
            end if;

            v_short  := v_needed - v_available;
            v_needed := v_available;
        end if;

        v_remaining := v_needed;

        for b in
            select id, remaining_quantity, buy_price
            from stock_batches
            where item_id = p_item_id
              and warehouse_id = p_warehouse_id
              and business_id = v_business
              and remaining_quantity > 0
            order by created_at
            for update
        loop
            exit when v_remaining <= 0;

            v_take := least(b.remaining_quantity, v_remaining);

            update stock_batches
            set remaining_quantity = remaining_quantity - v_take
            where id = b.id;

            v_cost := v_cost + v_take * b.buy_price;
            v_remaining := v_remaining - v_take;
        end loop;

        if v_short > 0 then
            select buy_price into v_ref_price
            from stock_batches
            where item_id = p_item_id
              and business_id = v_business
            order by created_at desc
            limit 1;

            v_cost := v_cost + v_short * coalesce(v_ref_price, 0);
        end if;

        select coalesce(sum(remaining_quantity), 0),
               coalesce(sum(remaining_quantity * buy_price), 0)
        into v_stock, v_value
        from stock_batches
        where item_id = p_item_id
          and business_id = v_business
          and remaining_quantity > 0;

        update items
        set stock = v_stock,
            buy_price = case when v_stock > 0 then v_value / v_stock
                             else buy_price end
        where id = p_item_id and business_id = v_business;
    end if;

    insert into sale_items (sale_id, item_id, quantity, unit_price, total, cost)
    values (
        p_sale_id, p_item_id, p_quantity, p_unit_price, p_total,
        case when v_has_recipe or v_has_stock then v_cost else null end
    );
end;
$$;

comment on function public.sell_line(uuid, uuid, numeric, uuid, numeric, numeric, boolean) is
  'داخلية - بتتنادى من record_sale. بتسحب المخزون (أو مكوّنات الوصفة) وتحسب التكلفة وتكتب سطر الفاتورة. p_allow_short=true بتكمّل البيع لو المسجّل أقل من المطلوب. التكلفة مابترجعش للمنادي.';

-- الكاشير مايناديهاش من برّه. record_sale بس (درس ٠٧٦ و٠٨٨).
revoke all on function public.sell_line(uuid, uuid, numeric, uuid, numeric, numeric, boolean)
  from public, anon, authenticated;

grant execute on function public.sell_line(uuid, uuid, numeric, uuid, numeric, numeric, boolean)
  to service_role;


-- ============================================================
-- ٣) record_sale - بتمرّر التأكيد
-- ============================================================
--
-- نسخة حرف بحرف من اللي قبلها، والفرق الوحيد الوسيط الجديد وتمريره
-- لـ`sell_line`. اتكتبت كاملة مش بـpatch عشان اللي بيقراها بعدين
-- يشوف الدالة كلها في مكان واحد.

drop function if exists public.record_sale(uuid, uuid, text, integer, numeric, uuid, jsonb);

create function public.record_sale(
    p_shift_id       uuid,
    p_warehouse_id   uuid,
    p_payment_method text,
    p_price_tier     integer,
    p_discount       numeric,
    p_customer_id    uuid,
    p_lines          jsonb,
    p_allow_short    boolean default false
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
            v_prices[i], v_qtys[i] * v_prices[i],
            coalesce(p_allow_short, false)
        );
    end loop;

    return v_sale;
end;
$$;

comment on function public.record_sale(uuid, uuid, text, integer, numeric, uuid, jsonb, boolean) is
  'الباب الوحيد لتسجيل فاتورة. الأسعار بتتحسب جوه القاعدة. p_allow_short=true بتكمّل لو المخزون المسجّل أقل من المطلوب - بتتبعت بعد تأكيد الكاشير بس.';

revoke all on function public.record_sale(uuid, uuid, text, integer, numeric, uuid, jsonb, boolean)
  from public, anon;

grant execute on function public.record_sale(uuid, uuid, text, integer, numeric, uuid, jsonb, boolean)
  to authenticated, service_role;

notify pgrst, 'reload schema';
