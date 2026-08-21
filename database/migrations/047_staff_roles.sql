-- ==========================================
-- OCTOPUS ERP
-- Migration 047: staff roles that actually mean something
--
-- WHY THIS EXISTS
-- Until now a business had exactly two kinds of person: 'owner' and
-- 'employee'. Every employee could do everything an employee could
-- do. But a shop with warehouses has a stock keeper who moves goods
-- and never touches the till, and a till has a cashier who sells and
-- should never be able to move stock between warehouses. Some shops
-- want one trusted employee with everything short of ownership.
--
-- THE RULE THIS FOLLOWS
-- A role is not a set of hidden buttons. Every permission below is
-- enforced in RLS, so a cashier who calls the API directly with their
-- own token still cannot transfer stock. This is the same lesson that
-- migrations 034 and 044 were written to apply.
--
-- SHAPE
--   staff_role         - one of three named roles, the normal case
--   extra_permissions  - the owner tops up one specific ability for
--                        one specific person, without promoting them
--
-- Owners always have everything; nothing below changes that.
-- ==========================================

alter table users
    add column if not exists staff_role text not null default 'cashier';

alter table users
    drop constraint if exists users_staff_role_check;

alter table users
    add constraint users_staff_role_check
    check (staff_role in ('cashier', 'stock_keeper', 'manager'));

alter table users
    add column if not exists extra_permissions text[] not null default '{}';

alter table users
    drop constraint if exists users_extra_permissions_check;

alter table users
    add constraint users_extra_permissions_check
    check (extra_permissions <@ array[
        'sell',
        'manage_expenses',
        'manage_customers',
        'give_discount',
        'transfer_stock',
        'receive_stock',
        'manage_items',
        'view_reports',
        'close_day'
    ]::text[]);

-- Existing employees keep doing exactly what they did yesterday.
update users set staff_role = 'cashier'
where role = 'employee' and staff_role is null;

update users set staff_role = 'manager'
where role = 'owner';

-- ------------------------------------------
-- What each named role can do
-- ------------------------------------------
create or replace function staff_role_permissions(p_staff_role text)
returns text[]
language sql
immutable
as $$
  select case p_staff_role
    when 'cashier' then array[
        'sell', 'manage_expenses', 'manage_customers', 'give_discount'
    ]
    when 'stock_keeper' then array[
        'transfer_stock', 'receive_stock'
    ]
    when 'manager' then array[
        'sell', 'manage_expenses', 'manage_customers', 'give_discount',
        'transfer_stock', 'receive_stock', 'manage_items',
        'view_reports', 'close_day'
    ]
    else array[]::text[]
  end
$$;

-- SECURITY DEFINER for the same reason as get_my_business_id():
-- policies on `users` that sub-query `users` would recurse.
create or replace function has_permission(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_role text;
    v_staff_role text;
    v_extra text[];
begin
    select role, staff_role, extra_permissions
    into v_role, v_staff_role, v_extra
    from users
    where auth_user_id = auth.uid()
      and active = true;

    if not found then
        return false;
    end if;

    -- The owner of the business is not limited by staff roles.
    if v_role = 'owner' then
        return true;
    end if;

    return p_key = any(
        staff_role_permissions(v_staff_role) || coalesce(v_extra, '{}')
    );
end;
$$;

revoke execute on function has_permission(text) from anon, public;
grant execute on function has_permission(text) to authenticated, service_role;

revoke execute on function staff_role_permissions(text) from anon, public;
grant execute on function staff_role_permissions(text) to authenticated, service_role;

-- ------------------------------------------
-- An employee must not be able to promote themselves
-- ------------------------------------------
-- The `users` UPDATE policy is already owner-only (migration 034), so
-- this is defence in depth - but staff_role and extra_permissions are
-- privilege columns now, and privilege columns get a trigger.
create or replace function protect_user_identity_columns()
returns trigger
language plpgsql
as $$
begin
    if auth.role() = 'service_role' then
        return new;
    end if;

    if new.role is distinct from old.role
       or new.business_id is distinct from old.business_id
       or new.auth_user_id is distinct from old.auth_user_id
       or new.email is distinct from old.email
    then
        raise exception 'غير مسموح بتعديل هوية المستخدم أو دوره أو إيميله مباشرة';
    end if;

    if (new.staff_role is distinct from old.staff_role
        or new.extra_permissions is distinct from old.extra_permissions)
       and not is_business_owner()
    then
        raise exception 'تغيير صلاحيات الموظفين لصاحب النشاط بس';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_protect_user_identity_columns on users;

create trigger trg_protect_user_identity_columns
before update on users
for each row execute function protect_user_identity_columns();

-- ==========================================
-- RLS: the permissions above, enforced
-- ==========================================

-- Selling ---------------------------------------------------------
drop policy if exists "sales_insert" on sales;

create policy "sales_insert" on sales
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and has_permission('sell')
);

drop policy if exists "sale_items_insert" on sale_items;

create policy "sale_items_insert" on sale_items
for insert to authenticated
with check (
  exists (
    select 1 from sales
    where sales.id = sale_items.sale_id
    and sales.business_id = get_my_business_id()
  )
  and has_permission('sell')
);

-- Expenses --------------------------------------------------------
drop policy if exists "expenses_insert" on expenses;

create policy "expenses_insert" on expenses
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and has_permission('manage_expenses')
);

-- Items -----------------------------------------------------------
-- A sale writes stock back, receiving stock writes stock in, and an
-- employee with manage_items edits the catalogue. Anyone else has no
-- business updating an item row at all.
drop policy if exists "items_update" on items;

create policy "items_update" on items
for update to authenticated
using (business_id = get_my_business_id())
with check (
  business_id = get_my_business_id()
  and (
    has_permission('sell')
    or has_permission('receive_stock')
    or has_permission('manage_items')
    or has_permission('transfer_stock')
  )
);

drop policy if exists "items_owner_insert" on items;

create policy "items_insert" on items
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and has_permission('manage_items')
);

-- Pricing stays behind an explicit manage_items grant, not behind
-- "is an employee" (migration 044 wrote this trigger for exactly the
-- sell-at-1-EGP-and-pocket-the-difference case).
create or replace function protect_item_pricing_columns()
returns trigger
language plpgsql
as $$
begin
    if auth.role() = 'service_role' or is_business_owner()
       or has_permission('manage_items') then
        return new;
    end if;

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

-- Stock batches ---------------------------------------------------
drop policy if exists "stock_batches_owner_insert" on stock_batches;

create policy "stock_batches_insert" on stock_batches
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and (has_permission('receive_stock') or has_permission('manage_items'))
);

drop policy if exists "stock_batches_update" on stock_batches;

create policy "stock_batches_update" on stock_batches
for update to authenticated
using (business_id = get_my_business_id())
with check (
  business_id = get_my_business_id()
  and (
    has_permission('sell')
    or has_permission('receive_stock')
    or has_permission('transfer_stock')
    or has_permission('manage_items')
  )
);

-- Closing the day -------------------------------------------------
drop policy if exists "shifts_owner_update" on shifts;

create policy "shifts_update" on shifts
for update to authenticated
using (business_id = get_my_business_id() and has_permission('close_day'))
with check (business_id = get_my_business_id());

-- Purchases (receiving stock) and transfers between warehouses.
-- Migration 044 made both owner-only, which is precisely what left a
-- stock keeper with nothing to do.
drop policy if exists "purchases_owner_insert" on purchases;

create policy "purchases_insert" on purchases
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and has_permission('receive_stock')
);

drop policy if exists "stock_transfers_owner_insert" on stock_transfers;

create policy "stock_transfers_insert" on stock_transfers
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and has_permission('transfer_stock')
);

-- Customers (running tabs) ---------------------------------------
drop policy if exists "customers_staff_insert" on customers;

create policy "customers_insert" on customers
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and has_permission('manage_customers')
);

drop policy if exists "customers_staff_update" on customers;

create policy "customers_update" on customers
for update to authenticated
using (business_id = get_my_business_id() and has_permission('manage_customers'))
with check (business_id = get_my_business_id());

drop policy if exists "customer_payments_insert" on customer_payments;

create policy "customer_payments_insert" on customer_payments
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and created_by = (select id from users where auth_user_id = auth.uid())
  and (amount > 0 or is_business_owner())
  and has_permission('manage_customers')
);

-- Categories: an employee allowed to manage items needs them too.
drop policy if exists "categories_owner_insert" on categories;

create policy "categories_insert" on categories
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and has_permission('manage_items')
);

drop policy if exists "categories_owner_update" on categories;

create policy "categories_update" on categories
for update to authenticated
using (business_id = get_my_business_id() and has_permission('manage_items'))
with check (business_id = get_my_business_id());
