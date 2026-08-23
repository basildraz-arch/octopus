-- 071 - التكلفة مابقتش تخرج للمتصفح وقت البيعة.
--
-- آخر حتة في الثغرة الأصلية.
--
-- المسار القديم كان تلات خطوات في المتصفح:
--   1. الكاشير بينادي draw_stock_fifo
--   2. الدالة بترجّعله الدفعات اللي اتسحبت **وسعر شرا كل دفعة**
--   3. الكود بيضرب ويجمع ويكتب sale_items.cost
--
-- يعني تكلفة كل صنف بيبيعه بتعدّي على متصفحه. أضيق بكتير من قراءة
-- الكتالوج كله (اللي اتقفل في 070) بس مش صفر - كاشير فاتح أدوات
-- المطوّر يشوف مكسبك في كل حاجة بيبيعها.
--
-- الحل: خطوة واحدة جوه قاعدة البيانات. sell_line بتسحب المخزون
-- **وتكتب سطر الفاتورة بنفسها** بالتكلفة اللي حسبتها. المتصفح
-- بيبعت الكمية والسعر بس، وبيستلم "تمام" وبس.
--
-- ليه ده أأمن من مجرد إخفاء العمود: التكلفة مابتتحسبش في المتصفح
-- أصلًا، فمفيش حاجة تتسرّب حتى لو حد قرا كل سطر في الكود المرفوع.
--
-- draw_stock_fifo لسه موجودة زي ما هي للتحويل بين المخازن وتعديل
-- الجرد - دول أدوار معاها صلاحية تشوف التكلفة أصلًا (item_costs).

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
    v_business  uuid := get_my_business_id();
    v_remaining numeric := p_quantity;
    v_take      numeric;
    v_available numeric;
    v_cost      numeric := 0;
    v_stock     numeric := 0;
    v_value     numeric := 0;
    v_has_stock boolean;
    b record;
begin
    if v_business is null then
        raise exception 'غير مصرّح';
    end if;

    if not has_permission('sell') then
        raise exception 'مش مسموح تبيع';
    end if;

    -- الفاتورة لازم تكون بتاعة نفس المحل. من غير الشرط ده كاشير
    -- يقدر يضيف سطور لفاتورة محل تاني.
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

    if v_has_stock then
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

        -- نفس منطق FIFO بتاع draw_stock_fifo، بس التكلفة بتتجمّع في
        -- متغير محلي ومابتخرجش.
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

        -- مخزون الصنف ومتوسط تكلفته بيتحسبوا من الدفعات من أول
        -- وجديد - نفس اللي draw_stock_fifo بتعمله، في نفس المعاملة.
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
        case when v_has_stock then v_cost else null end
    );
end;
$$;

comment on function public.sell_line(uuid, uuid, numeric, uuid, numeric, numeric) is
  'بتسحب المخزون وتكتب سطر الفاتورة بتكلفته في خطوة واحدة. التكلفة مابترجعش للمنادي - ده الفرق الوحيد بينها وبين draw_stock_fifo، وهو سبب وجودها.';

revoke all on function
  public.sell_line(uuid, uuid, numeric, uuid, numeric, numeric)
  from public, anon;

grant execute on function
  public.sell_line(uuid, uuid, numeric, uuid, numeric, numeric)
  to authenticated;

-- لازم يفضل آخر سطر - Supabase مابيشوفش الدالة الجديدة من غيره.
notify pgrst, 'reload schema';
