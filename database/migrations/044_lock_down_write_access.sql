-- ==========================================
-- OCTOPUS ERP
-- Security review: replace every blanket "FOR ALL" policy
--
-- Migration 034 fixed this pattern on `users` after finding a cashier
-- could promote themselves to owner. A full review found the same
-- shape everywhere else, and the worst case is far more damaging than
-- the first one:
--
--   * A cashier could DELETE a sale. Verified against live data.
--     That defeats the entire anti-theft feature set - sell, take the
--     cash, delete the row. The cart audit log would still hold a
--     'checkout' event, but the money row would be gone.
--   * A cashier could DELETE expenses.
--   * A cashier could rewrite item prices (sell at 1 EGP, pocket the
--     difference).
--   * A cashier could edit the business record itself - shop name,
--     max discount percent, enabled features.
--
-- None of these were reachable through the UI. All were reachable
-- with one API call using the cashier's own token, because
-- "business_isolation FOR ALL" grants INSERT, UPDATE and DELETE to
-- anyone inside the business.
--
-- The principle applied below: financial history is append-only from
-- the client, configuration is owner-only, and a cashier may write
-- exactly what selling requires and nothing else.
-- ==========================================

-- ==========================================
-- sales / sale_items - append-only from the client
--
-- Nothing in the app updates or deletes a sale. Voiding one, if it is
-- ever needed, belongs behind a status column and an audit entry -
-- not behind a policy that lets the till erase its own history.
-- ==========================================

drop policy if exists "business_isolation" on sales;

create policy "sales_read" on sales
for select to authenticated
using (business_id = get_my_business_id());

create policy "sales_insert" on sales
for insert to authenticated
with check (business_id = get_my_business_id());

drop policy if exists "business_isolation" on sale_items;

create policy "sale_items_read" on sale_items
for select to authenticated
using (
  exists (
    select 1 from sales
    where sales.id = sale_items.sale_id
    and sales.business_id = get_my_business_id()
  )
);

create policy "sale_items_insert" on sale_items
for insert to authenticated
with check (
  exists (
    select 1 from sales
    where sales.id = sale_items.sale_id
    and sales.business_id = get_my_business_id()
  )
);

-- ==========================================
-- expenses - a cashier records them, only an owner rewrites them
-- ==========================================

drop policy if exists "business_isolation" on expenses;

create policy "expenses_read" on expenses
for select to authenticated
using (business_id = get_my_business_id());

create policy "expenses_insert" on expenses
for insert to authenticated
with check (business_id = get_my_business_id());

create policy "expenses_owner_update" on expenses
for update to authenticated
using (business_id = get_my_business_id() and is_business_owner())
with check (business_id = get_my_business_id());

create policy "expenses_owner_delete" on expenses
for delete to authenticated
using (business_id = get_my_business_id() and is_business_owner());

-- ==========================================
-- items - a sale legitimately writes back stock and average cost, so
-- cashiers keep UPDATE. A trigger stops that from becoming a licence
-- to re-price the menu.
-- ==========================================

drop policy if exists "business_isolation" on items;

create policy "items_read" on items
for select to authenticated
using (business_id = get_my_business_id());

create policy "items_owner_insert" on items
for insert to authenticated
with check (business_id = get_my_business_id() and is_business_owner());

create policy "items_update" on items
for update to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

create policy "items_owner_delete" on items
for delete to authenticated
using (business_id = get_my_business_id() and is_business_owner());

create or replace function protect_item_pricing_columns()
returns trigger
language plpgsql
as $$
begin
    if auth.role() = 'service_role' or is_business_owner() then
        return new;
    end if;

    -- What a sale is allowed to change: stock and the recalculated
    -- average cost. Everything that decides what a customer is
    -- charged is off limits.
    if new.sell_price is distinct from old.sell_price
       or new.sell_price_2 is distinct from old.sell_price_2
       or new.sell_price_3 is distinct from old.sell_price_3
       or new.min_sell_price is distinct from old.min_sell_price
       or new.name is distinct from old.name
       or new.barcode is distinct from old.barcode
       or new.category_id is distinct from old.category_id
       or new.item_type is distinct from old.item_type
       or new.sale_method is distinct from old.sale_method
       or new.active is distinct from old.active
       or new.business_id is distinct from old.business_id
    then
        raise exception 'تعديل أسعار وبيانات الأصناف لصاحب النشاط بس';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_protect_item_pricing_columns on items;

create trigger trg_protect_item_pricing_columns
before update on items
for each row execute function protect_item_pricing_columns();

-- ==========================================
-- stock_batches - the FIFO draw during a sale updates
-- remaining_quantity, so UPDATE stays open to staff. Creating and
-- removing batches is stock-taking, which is the owner's job.
-- ==========================================

drop policy if exists "business_isolation" on stock_batches;

create policy "stock_batches_read" on stock_batches
for select to authenticated
using (business_id = get_my_business_id());

create policy "stock_batches_owner_insert" on stock_batches
for insert to authenticated
with check (business_id = get_my_business_id() and is_business_owner());

create policy "stock_batches_update" on stock_batches
for update to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

-- ==========================================
-- shifts - staff open one by selling; only an owner closes or
-- reopens a day, and nobody deletes one.
-- ==========================================

drop policy if exists "business_isolation" on shifts;

create policy "shifts_read" on shifts
for select to authenticated
using (business_id = get_my_business_id());

create policy "shifts_insert" on shifts
for insert to authenticated
with check (business_id = get_my_business_id());

create policy "shifts_owner_update" on shifts
for update to authenticated
using (business_id = get_my_business_id() and is_business_owner())
with check (business_id = get_my_business_id());

-- ==========================================
-- businesses - configuration, so owner-only. Creation happens inside
-- complete_signup() (SECURITY DEFINER) and deletion nowhere.
-- ==========================================

drop policy if exists "business_isolation" on businesses;

create policy "businesses_read" on businesses
for select to authenticated
using (id = get_my_business_id());

create policy "businesses_owner_update" on businesses
for update to authenticated
using (id = get_my_business_id() and is_business_owner())
with check (id = get_my_business_id());

-- ==========================================
-- Owner-only configuration tables. Everyone in the shop can read
-- them (the till needs categories and warehouses); only the owner
-- changes them.
-- ==========================================

do $$
declare
    t text;
begin
    foreach t in array array[
        'categories', 'warehouses', 'branches', 'roles',
        'purchases', 'stock_transfers'
    ]
    loop
        execute format('drop policy if exists %I on %I', 'business_isolation', t);

        execute format(
            'create policy %I on %I for select to authenticated using (business_id = get_my_business_id())',
            t || '_read', t
        );

        execute format(
            'create policy %I on %I for insert to authenticated with check (business_id = get_my_business_id() and is_business_owner())',
            t || '_owner_insert', t
        );

        execute format(
            'create policy %I on %I for update to authenticated using (business_id = get_my_business_id() and is_business_owner()) with check (business_id = get_my_business_id())',
            t || '_owner_update', t
        );

        execute format(
            'create policy %I on %I for delete to authenticated using (business_id = get_my_business_id() and is_business_owner())',
            t || '_owner_delete', t
        );
    end loop;
end;
$$;

-- role_permissions hangs off roles rather than carrying business_id.
drop policy if exists "business_isolation" on role_permissions;

create policy "role_permissions_read" on role_permissions
for select to authenticated
using (
  exists (
    select 1 from roles
    where roles.id = role_permissions.role_id
    and roles.business_id = get_my_business_id()
  )
);

create policy "role_permissions_owner_write" on role_permissions
for all to authenticated
using (
  is_business_owner()
  and exists (
    select 1 from roles
    where roles.id = role_permissions.role_id
    and roles.business_id = get_my_business_id()
  )
)
with check (
  is_business_owner()
  and exists (
    select 1 from roles
    where roles.id = role_permissions.role_id
    and roles.business_id = get_my_business_id()
  )
);

-- assistant_usage is a per-business quota counter, bumped by the
-- owner-only assistant route.
drop policy if exists "business_isolation" on assistant_usage;

create policy "assistant_usage_read" on assistant_usage
for select to authenticated
using (business_id = get_my_business_id());

create policy "assistant_usage_owner_write" on assistant_usage
for all to authenticated
using (business_id = get_my_business_id() and is_business_owner())
with check (business_id = get_my_business_id() and is_business_owner());
