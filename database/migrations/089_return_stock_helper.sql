-- ٠٨٩ — رجوع البضاعة للمخزون: منطق واحد لكل الحالات
--
-- ============================================================
-- ليه دالة مشتركة
-- ============================================================
--
-- `void_sale` (٠٨٥) فيها منطق رجوع البضاعة كامل: دفعة جديدة
-- بالتكلفة المسجّلة، وتوزيع التكلفة على مكوّنات الوصفة بنسبة قيمتها.
--
-- والمرتجع الجزئي (٠٩٠) محتاج **نفس المنطق بالحرف**. ولو اتكتب
-- تاني، الاتنين هيفترقوا: حد هيصلّح توزيع تكلفة الوصفة في واحدة
-- وينسى التانية، والفرق مش هيبان غير في جرد بعد شهور.
--
-- فالمنطق بقى في دالة واحدة، والاتنين بينادوها. و`void_sale`
-- اتعادت كتابتها في ٠٨٩ب عشان تناديها بدل النسخة اللي جواها.
--
-- ============================================================
-- الحدود (متوارثة من ٠٨٥)
-- ============================================================
--
-- السحب FIFO مابيسجّلش من أنهي دفعة سحب، فالإرجاع بيعمل **دفعة
-- جديدة** بالتكلفة المسجّلة في `sale_items.cost`. القيمة اللي خرجت
-- هي اللي بترجع بالمليم؛ اللي بيتغيّر هو ترتيب الدفعات في الطابور
-- بس.
--
-- و`created_at` بتاع الدفعة الراجعة = وقت الفاتورة الأصلية، عشان
-- ترجع مكانها التقريبي في الطابور بدل ما تروح لآخره.

create or replace function public.return_line_to_stock(
    p_business    uuid,
    p_item_id     uuid,
    p_quantity    numeric,
    p_cost        numeric,   -- تكلفة الكمية دي كلها، مش تكلفة الوحدة
    p_warehouse   uuid,
    p_dated       timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_comp_total numeric;
    c record;
begin
    -- `cost is null` = صنف خدمة (مالوش مخزون). مفيش حاجة ترجع.
    if p_cost is null or p_quantity is null or p_quantity <= 0 then
        return;
    end if;

    if exists (
        select 1 from item_components
        where parent_item_id = p_item_id and business_id = p_business
    ) then
        -- صنف بوصفة: المكوّنات هي اللي خرجت، فهي اللي ترجع.
        --
        -- التكلفة المبعوتة إجمالي. بنوزّعها على المكوّنات **بنسبة
        -- قيمتها الحالية** عشان مجموع اللي رجع يساوي اللي خرج
        -- بالظبط - لو وزّعناها بالكمية، كيلو بن وكيلو سكر هياخدوا
        -- نفس التكلفة وde غلط.
        select sum(ic.quantity * coalesce(ci.buy_price, 0))
        into v_comp_total
        from item_components ic
        join items ci on ci.id = ic.component_item_id
        where ic.parent_item_id = p_item_id
          and ic.business_id = p_business;

        for c in
            select ic.component_item_id, ic.quantity,
                   coalesce(ci.buy_price, 0) as unit_cost
            from item_components ic
            join items ci on ci.id = ic.component_item_id
            where ic.parent_item_id = p_item_id
              and ic.business_id = p_business
        loop
            insert into stock_batches (
                business_id, item_id, warehouse_id, purchase_id,
                quantity, remaining_quantity, buy_price, created_at
            ) values (
                p_business, c.component_item_id, p_warehouse, null,
                p_quantity * c.quantity,
                p_quantity * c.quantity,
                case
                    when v_comp_total > 0
                    then (p_cost * (c.quantity * c.unit_cost) / v_comp_total)
                         / nullif(c.quantity, 0)
                    else 0
                end,
                p_dated
            );

            update items set updated_at = now()
            where id = c.component_item_id and business_id = p_business;
        end loop;

        return;
    end if;

    -- صنف عادي له مخزون
    if not exists (
        select 1 from items
        where id = p_item_id and business_id = p_business and has_stock
    ) then
        return;
    end if;

    insert into stock_batches (
        business_id, item_id, warehouse_id, purchase_id,
        quantity, remaining_quantity, buy_price, created_at
    ) values (
        p_business, p_item_id, p_warehouse, null,
        p_quantity, p_quantity, p_cost / p_quantity, p_dated
    );

    -- تريجر ٠٧٢ بيعيد اشتقاق stock و buy_price من الدفعات.
    update items set updated_at = now()
    where id = p_item_id and business_id = p_business;
end;
$$;

-- داخلية بحتة: مفيش أي حد ينادیها من المتصفح. `void_sale` و
-- `return_sale_lines` بس، والاتنين SECURITY DEFINER فبينفّذوها
-- بصلاحيات المالك.
revoke all on function
  public.return_line_to_stock(uuid, uuid, numeric, numeric, uuid, timestamptz)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
