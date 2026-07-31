-- ==========================================
-- OCTOPUS ERP
-- Row Level Security (basic business isolation)
--
-- One rule everywhere: a signed-in user can only see/change rows
-- that belong to their own business. Nothing finer-grained yet
-- (Owner vs Employee restrictions stay enforced in the app, same
-- as before) - this migration closes the "anyone with the anon
-- key can read/write every business's data" hole before the app
-- goes public.
--
-- get_my_business_id() is SECURITY DEFINER so it can look up the
-- caller's business_id in `users` without RLS on `users` recursing
-- into itself while evaluating that same lookup.
-- ==========================================

create or replace function get_my_business_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select business_id from users where auth_user_id = auth.uid()
$$;

-- ==========================================
-- Tables with a direct business_id column
-- ==========================================

alter table businesses enable row level security;

drop policy if exists "business_isolation" on businesses;

create policy "business_isolation" on businesses
for all to authenticated
using (id = get_my_business_id())
with check (id = get_my_business_id());

alter table branches enable row level security;

drop policy if exists "business_isolation" on branches;

create policy "business_isolation" on branches
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

alter table users enable row level security;

drop policy if exists "business_isolation" on users;

create policy "business_isolation" on users
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

alter table roles enable row level security;

drop policy if exists "business_isolation" on roles;

create policy "business_isolation" on roles
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

alter table categories enable row level security;

drop policy if exists "business_isolation" on categories;

create policy "business_isolation" on categories
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

alter table items enable row level security;

drop policy if exists "business_isolation" on items;

create policy "business_isolation" on items
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

alter table sales enable row level security;

drop policy if exists "business_isolation" on sales;

create policy "business_isolation" on sales
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

alter table shifts enable row level security;

drop policy if exists "business_isolation" on shifts;

create policy "business_isolation" on shifts
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

-- ==========================================
-- Tables without a direct business_id column
-- (checked through their parent table instead)
-- ==========================================

alter table role_permissions enable row level security;

drop policy if exists "business_isolation" on role_permissions;

create policy "business_isolation" on role_permissions
for all to authenticated
using (
  exists (
    select 1 from roles
    where roles.id = role_permissions.role_id
    and roles.business_id = get_my_business_id()
  )
)
with check (
  exists (
    select 1 from roles
    where roles.id = role_permissions.role_id
    and roles.business_id = get_my_business_id()
  )
);

alter table sale_items enable row level security;

drop policy if exists "business_isolation" on sale_items;

create policy "business_isolation" on sale_items
for all to authenticated
using (
  exists (
    select 1 from sales
    where sales.id = sale_items.sale_id
    and sales.business_id = get_my_business_id()
  )
)
with check (
  exists (
    select 1 from sales
    where sales.id = sale_items.sale_id
    and sales.business_id = get_my_business_id()
  )
);
