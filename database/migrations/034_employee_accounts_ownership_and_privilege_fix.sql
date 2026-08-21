-- ==========================================
-- OCTOPUS ERP
-- Employee accounts belong to the owner + privilege escalation fix
--
-- CRITICAL FIX INCLUDED HERE:
-- The "business_isolation" policy on `users` was FOR ALL, so any
-- signed-in employee could UPDATE any row in their own business -
-- including their own - and set role = 'owner'. Verified
-- reproducible against live data before writing this migration.
-- Same class of bug as the earlier "financial data returned to any
-- role" hole: the app-side UI never offered the action, but the
-- database happily allowed it, so a single crafted API call was
-- enough. Split into per-command policies below.
-- ==========================================

-- SECURITY DEFINER for the same reason get_my_business_id() is:
-- a policy on `users` that sub-queries `users` would recurse.
create or replace function is_business_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from users
    where auth_user_id = auth.uid()
    and role = 'owner'
    and active = true
  )
$$;

revoke execute on function is_business_owner() from anon;
revoke execute on function is_business_owner() from public;
grant execute on function is_business_owner() to authenticated;
grant execute on function is_business_owner() to service_role;

-- ==========================================
-- users: replace the blanket FOR ALL policy
-- ==========================================

drop policy if exists "business_isolation" on users;

-- Everyone in the business can still READ the staff list (needed for
-- report joins, "sold by" labels, the cashier's own profile...).
create policy "users_read_own_business" on users
for select to authenticated
using (business_id = get_my_business_id());

-- Only an owner may create/modify/remove staff rows, and only inside
-- their own business. Employees get no write access at all.
create policy "users_owner_insert" on users
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and is_business_owner()
);

create policy "users_owner_update" on users
for update to authenticated
using (
  business_id = get_my_business_id()
  and is_business_owner()
)
with check (
  business_id = get_my_business_id()
);

-- An owner can remove employees, never another owner (and not
-- themselves) - that stays a Master-level action.
create policy "users_owner_delete_employees" on users
for delete to authenticated
using (
  business_id = get_my_business_id()
  and is_business_owner()
  and role = 'employee'
);

-- Even an owner must not be able to rewrite identity columns from the
-- client: role (privilege), business_id (tenant), auth_user_id (which
-- login this row answers to), email (the login identifier itself).
-- Those only change through service-role code paths that do the
-- matching auth.users work in the same operation.
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

    return new;
end;
$$;

drop trigger if exists trg_protect_user_identity_columns on users;

create trigger trg_protect_user_identity_columns
before update on users
for each row execute function protect_user_identity_columns();

-- ==========================================
-- Employee logins have no life of their own
-- ==========================================

-- Short, stable, per-business code used to namespace employee login
-- addresses (mohamed@kero.octopus.local). Stored rather than derived
-- so renaming the shop never invalidates existing logins.
alter table businesses
    add column if not exists employee_email_code text unique;

create or replace function protect_employee_email_code()
returns trigger
language plpgsql
as $$
begin
    if auth.role() = 'service_role' then
        return new;
    end if;

    if old.employee_email_code is not null
       and new.employee_email_code is distinct from old.employee_email_code
    then
        raise exception 'كود إيميلات الموظفين مينفعش يتغير بعد ما يتحدد';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_protect_employee_email_code on businesses;

create trigger trg_protect_employee_email_code
before update on businesses
for each row execute function protect_employee_email_code();

-- When a business is deleted, `users` rows cascade away - but their
-- Supabase Auth accounts would survive as orphan logins. An employee
-- account must not outlive the business it was created for.
-- Employees only: an owner's auth account is their own identity and
-- is never removed as a side effect.
create or replace function delete_employee_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if old.role = 'employee' and old.auth_user_id is not null then
        delete from auth.users where id = old.auth_user_id;
    end if;

    return old;
end;
$$;

drop trigger if exists trg_delete_employee_auth_user on users;

create trigger trg_delete_employee_auth_user
after delete on users
for each row execute function delete_employee_auth_user();

-- ==========================================
-- ⚠ SUPERSEDED BELOW - see migration 039.
--
-- The complete_signup() body in this file was rebuilt from migration
-- 022 and therefore silently reverted 023/025/027/028 (enabled
-- features, the default warehouse for every business, trial dates).
-- Migration 039 restores 028's behaviour with this file's guard kept.
-- Applying migrations in order is safe; do not copy the version below
-- on its own.
-- ==========================================

-- ==========================================
-- An employee login cannot bootstrap its own business
--
-- complete_signup() already refused when a users row exists, which
-- covers the normal case. This adds a second, independent guard on
-- the login domain itself, so a stale/deleted employee row can't be
-- used to spin up a business from a shop-issued account.
-- ==========================================

create or replace function complete_signup()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_auth_user_id uuid := auth.uid();
    v_metadata jsonb;
    v_email text;
    v_full_name text;
    v_business_name text;
    v_app_mode text;
    v_business_id uuid;
begin
    if v_auth_user_id is null then
        raise exception 'يجب تسجيل الدخول أولاً';
    end if;

    if exists (select 1 from users where auth_user_id = v_auth_user_id) then
        raise exception 'الحساب مربوط ببيزنس بالفعل';
    end if;

    select email, raw_user_meta_data into v_email, v_metadata
    from auth.users
    where id = v_auth_user_id;

    if v_email like '%@octopus.local' or v_email like '%.octopus.local' then
        raise exception 'حساب موظف مينفعش يسجّل بيزنس لوحده';
    end if;

    v_full_name := v_metadata ->> 'full_name';
    v_business_name := v_metadata ->> 'business_name';
    v_app_mode := coalesce(v_metadata ->> 'app_mode', 'retail');

    if v_full_name is null or v_business_name is null then
        raise exception 'بيانات التسجيل غير مكتملة';
    end if;

    if v_app_mode not in ('retail', 'warehouse_management') then
        raise exception 'نوع نشاط غير صالح';
    end if;

    insert into businesses (name, business_type, app_mode)
    values (v_business_name, 'other', v_app_mode)
    returning id into v_business_id;

    insert into users (business_id, auth_user_id, full_name, email, role)
    values (
        v_business_id,
        v_auth_user_id,
        v_full_name,
        v_email,
        'owner'
    );

    if v_app_mode = 'warehouse_management' then
        insert into warehouses (business_id, name, is_default)
        values (v_business_id, 'المخزن الرئيسي', true);
    end if;

    return v_business_id;
end;
$$;

grant execute on function complete_signup() to authenticated;
