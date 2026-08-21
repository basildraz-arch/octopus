-- ==========================================
-- OCTOPUS ERP
-- Migration 053: the till stops writing to stock
--
-- THE LAST BROAD WRITE A CASHIER HAD
-- The August review closed four holes but left one open on purpose,
-- because closing it needed this: selling drew stock FIFO from the
-- browser - read the batches, then send one UPDATE per batch - so
-- every cashier had to hold UPDATE on stock_batches and on items.
-- That is the same "it's needed for normal work" shape that made the
-- other four holes look reasonable when they were written.
--
-- It was also wrong for a second reason that has nothing to do with
-- security: two tills selling the last unit at the same moment both
-- read "1 available" and both sold it. Nothing locked anything.
--
-- draw_stock_fifo() does the whole thing in one transaction: checks
-- the permission itself, locks the batches with FOR UPDATE, refuses
-- to go below zero, decrements, and recalculates the item's stock and
-- average cost. It is SECURITY DEFINER, so the caller does not need
-- write access to either table - which is what lets the two policies
-- at the bottom drop 'sell' entirely.
--
-- After this, a cashier's complete list of writes is: sales,
-- sale_items, expenses, customers, customer_payments, cart_audit_log,
-- and opening a shift. Nothing else in the database will take a write
-- from them at all.
--
-- Verified against live data, as a real cashier account:
--   * a 3-unit draw succeeds and moves the item from 100 to 97
--   * a direct UPDATE on stock_batches changes 0 rows
--   * a direct UPDATE on items changes 0 rows
--   * a draw of 999999 is refused
-- ==========================================

create or replace function draw_stock_fifo(
    p_item_id uuid,
    p_quantity numeric,
    p_warehouse_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_business uuid := get_my_business_id();
    v_remaining numeric := p_quantity;
    v_available numeric;
    v_take numeric;
    v_draws jsonb := '[]'::jsonb;
    v_stock numeric := 0;
    v_cost numeric := 0;
    b record;
begin
    if v_business is null then
        raise exception 'غير مصرّح';
    end if;

    if p_quantity is null or p_quantity <= 0 then
        raise exception 'الكمية لازم تكون أكبر من صفر';
    end if;

    -- Selling draws stock, and so does moving it between warehouses.
    -- Nothing else does.
    if not (has_permission('sell') or has_permission('transfer_stock')) then
        raise exception 'مش مسموح تسحب من المخزون';
    end if;

    -- SECURITY DEFINER means RLS is not doing the tenant check here,
    -- so it is done explicitly, twice.
    if not exists (
        select 1 from items where id = p_item_id and business_id = v_business
    ) then
        raise exception 'الصنف مش من نشاطك';
    end if;

    if not exists (
        select 1 from warehouses where id = p_warehouse_id and business_id = v_business
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

    -- FOR UPDATE is the point: the second till waits here instead of
    -- reading a number the first till is about to spend.
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

        v_draws := v_draws || jsonb_build_object(
            'batchId', b.id,
            'quantity', v_take,
            'buyPrice', b.buy_price
        );

        v_remaining := v_remaining - v_take;
    end loop;

    select coalesce(sum(remaining_quantity), 0),
           coalesce(sum(remaining_quantity * buy_price), 0)
    into v_stock, v_cost
    from stock_batches
    where item_id = p_item_id
      and business_id = v_business
      and remaining_quantity > 0;

    update items
    set stock = v_stock,
        buy_price = case when v_stock > 0 then v_cost / v_stock else buy_price end
    where id = p_item_id
      and business_id = v_business;

    return v_draws;
end;
$$;

revoke execute on function draw_stock_fifo(uuid, numeric, uuid) from public, anon;
grant execute on function draw_stock_fifo(uuid, numeric, uuid) to authenticated, service_role;

-- Selling no longer needs either of these.
drop policy if exists "stock_batches_update" on stock_batches;

create policy "stock_batches_update" on stock_batches
for update to authenticated
using (business_id = get_my_business_id())
with check (
  business_id = get_my_business_id()
  and (has_permission('receive_stock') or has_permission('manage_items'))
);

drop policy if exists "items_update" on items;

create policy "items_update" on items
for update to authenticated
using (business_id = get_my_business_id())
with check (
  business_id = get_my_business_id()
  and (has_permission('receive_stock') or has_permission('manage_items'))
);
