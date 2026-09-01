-- 078 - بيع الصنف المركّب بيخصم مكوّناته.
--
-- الجزء التاني من ٠٧٧. الجدول والتحقق والكمية المتاحة اتعملوا هناك،
-- ودي حتة البيع.
--
-- المنطق الجديد بيتحط **قبل** منطق المخزون العادي، وبيتنفّذ بس لو
-- الصنف له وصفة. أي صنف مالوش صفوف في item_components بيمشي في نفس
-- الطريق القديم حرف بحرف - يعني ٩٥ صنف عند كيرو مايتأثروش.
--
-- التكلفة بتتجمّع من المكوّنات: تبيع كوباية فيها ١٨ جرام بن بـ٤٠٠ ج
-- للكيلو، سطر الفاتورة بيتكتب بتكلفة ٧.٢ ج. نفس مبدأ ٠٧١ - التكلفة
-- بتتحسب جوه القاعدة ومابتخرجش للمتصفح.
--
-- ومخزون كل مكوّن بيتحدّث بـupdate على items، والتريجر بتاع ٠٧٢
-- (items_derive_stock_and_cost) هو اللي بيحسب الرقم من الدفعات.
-- مابنبعتش الرقم، بنقول "اتغيّرت" وهو يحسب.

create or replace function public.sell_line(
    p_sale_id      uuid,
    p_item_id      uuid,
    p_quantity     numeric,
    p_warehouse_id uuid,
    p_unit_price   numeric,
    p_total        numeric
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

    -- ===== صنف مركّب: المكوّنات هي اللي بتنقص =====
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

            -- الرسالة بتقول اسم المكوّن الناقص بالظبط. "الكمية أكبر
            -- من المخزون" على كوباية قهوة مش معلومة - الكاشير عايز
            -- يعرف إن **اللبن** هو اللي خلص.
            if v_available < v_needed then
                raise exception 'خلص %: محتاج % والمتاح %',
                    c.name, v_needed, v_available;
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

            -- التريجر بتاع 072 بيعيد اشتقاق stock و buy_price من
            -- الدفعات. بنقوله "الصف اتغير" وهو يحسب - مابنبعتش رقم.
            update items set updated_at = now()
            where id = c.component_item_id and business_id = v_business;
        end loop;

    -- ===== صنف عادي: نفس المنطق القديم بالظبط =====
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

        if v_available < p_quantity then
            raise exception 'الكمية المطلوبة أكبر من المخزون المتاح فعليًا';
        end if;

        v_remaining := p_quantity;

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

comment on function public.sell_line(uuid, uuid, numeric, uuid, numeric, numeric) is
  'داخلية - بتتنادى من record_sale. بتسحب المخزون (أو مكوّنات الوصفة) وتحسب التكلفة وتكتب سطر الفاتورة. التكلفة مابترجعش للمنادي.';

notify pgrst, 'reload schema';
