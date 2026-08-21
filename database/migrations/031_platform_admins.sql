-- ==========================================
-- OCTOPUS ERP
-- Platform admins ("Master") — Basel's cross-business admin tier
--
-- Deliberately NOT a value inside users.role: users is a
-- business-scoped, tenant table (business_id not null), and a
-- platform-wide admin is not a tenant. Keeping this as its own
-- table with its own RLS means a bug in "owner adds an employee"
-- code can never, even in theory, create a master-level account —
-- the two code paths don't share a table.
--
-- is_platform_admin() replaces the hardcoded
-- "basildraz@gmail.com" check that was added directly inside the
-- user_activity_log RLS policy in migration 016. That was a
-- stopgap; this migration is the real mechanism, and it also
-- updates that old policy to use it.
-- ==========================================

create table if not exists platform_admins (
    id uuid primary key default gen_random_uuid(),

    auth_user_id uuid not null unique
        references auth.users(id)
        on delete cascade,

    full_name text not null,

    active boolean not null default true,

    created_at timestamptz not null default now()
);

-- Seed Basel as the first platform admin. Anyone else must be
-- added by direct SQL/service-role action later — deliberately not
-- exposed through any client-callable insert path (see RLS below).
insert into platform_admins (auth_user_id, full_name)
select id, 'باسل (Master)'
from auth.users
where email = 'basildraz@gmail.com'
on conflict (auth_user_id) do nothing;

create or replace function is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from platform_admins
    where auth_user_id = auth.uid()
    and active = true
  )
$$;

revoke all on function is_platform_admin() from public;
grant execute on function is_platform_admin() to authenticated;

alter table platform_admins enable row level security;

-- A platform admin can see the roster (so the Master UI can list
-- who else has this access) — nobody else can see this table at
-- all, and there is no insert/update/delete policy for the
-- `authenticated` role whatsoever. Granting master access is
-- intentionally impossible from the app; it only ever happens via
-- direct SQL by someone with database access.
drop policy if exists "platform_admins_self_read" on platform_admins;

create policy "platform_admins_self_read" on platform_admins
for select to authenticated
using (is_platform_admin());

-- ==========================================
-- Replace the migration-016 hardcoded-email hack with the real
-- mechanism now that it exists.
-- ==========================================

drop policy if exists "read_activity" on user_activity_log;

create policy "read_activity" on user_activity_log
for select to authenticated
using (
  business_id = get_my_business_id()
  or is_platform_admin()
);

-- ==========================================
-- Master read-only visibility across businesses (foundation for
-- item 8's dashboard). SELECT only, additive to the existing
-- per-business "business_isolation" policies — a platform admin
-- can never write to tenant data through these policies. Any
-- write a Master needs to make (approve an employee, disable a
-- business, ...) goes through a dedicated, audited function or
-- server-side route instead of a blanket table grant.
-- ==========================================

drop policy if exists "platform_admin_read" on businesses;
create policy "platform_admin_read" on businesses
for select to authenticated
using (is_platform_admin());

drop policy if exists "platform_admin_read" on branches;
create policy "platform_admin_read" on branches
for select to authenticated
using (is_platform_admin());

drop policy if exists "platform_admin_read" on users;
create policy "platform_admin_read" on users
for select to authenticated
using (is_platform_admin());

drop policy if exists "platform_admin_read" on roles;
create policy "platform_admin_read" on roles
for select to authenticated
using (is_platform_admin());

drop policy if exists "platform_admin_read" on categories;
create policy "platform_admin_read" on categories
for select to authenticated
using (is_platform_admin());

drop policy if exists "platform_admin_read" on items;
create policy "platform_admin_read" on items
for select to authenticated
using (is_platform_admin());

drop policy if exists "platform_admin_read" on sales;
create policy "platform_admin_read" on sales
for select to authenticated
using (is_platform_admin());

drop policy if exists "platform_admin_read" on shifts;
create policy "platform_admin_read" on shifts
for select to authenticated
using (is_platform_admin());

drop policy if exists "platform_admin_read" on sale_items;
create policy "platform_admin_read" on sale_items
for select to authenticated
using (is_platform_admin());
