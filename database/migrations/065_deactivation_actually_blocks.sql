-- 065 - Deactivation has to bite at the data layer, not in the browser.
--
-- Reported from outside the project: switching an account off in Master
-- returned a clean response with the right payload, and the person kept
-- working. True on both counts, for two different reasons:
--
--   1. get_my_business_id() never looked at users.active, and 27 read
--      policies route through it. A switched-off employee kept reading
--      the whole shop.
--   2. Nothing anywhere looked at businesses.active - zero policies
--      mentioned it - so switching a whole shop off changed a flag in
--      Master and nothing else. Six users sat in shops marked inactive
--      and were still fully operational.
--
-- has_permission() and is_business_owner() already checked users.active,
-- which is why writes were mostly held. The hole was reads, and the
-- entire business-level switch.
--
-- Fixed at the three choke points every policy already goes through,
-- rather than by editing ~50 policies one at a time. Editing policies
-- individually is how the gap got here: miss one and it stays open.
--
-- Decided with Basel: a suspended SHOP can still read its own data, so
-- the owner can open the app, see the bill and pay it without phoning
-- anybody. A switched-off PERSON gets nothing at all.

-- Is the caller's shop switched on? Suspension is about the shop, so
-- this deliberately says nothing about who the caller is.
create or replace function public.my_business_active()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from users u
    join businesses b on b.id = u.business_id
    where u.auth_user_id = auth.uid()
      and u.active = true
      and b.active = true
  )
$$;

comment on function public.my_business_active() is
  'True when the caller is an active user of an active business. Gates writes only - a suspended shop can still read its own data so the owner can see the bill and pay it.';

-- A switched-off person has no business id at all. This is the widest
-- blast radius in the migration: it closes every read policy shaped
-- "business_id = get_my_business_id()" in one move.
create or replace function public.get_my_business_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select business_id from users
  where auth_user_id = auth.uid() and active = true
$$;

-- Writes stop when the shop is suspended. Reads are untouched on
-- purpose: has_permission() appears in 10 INSERT and 5 UPDATE policies
-- and in no SELECT policy at all, so this cannot blind anybody.
create or replace function public.has_permission(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
    v_role text;
    v_staff_role text;
    v_extra text[];
begin
    select u.role, u.staff_role, u.extra_permissions
    into v_role, v_staff_role, v_extra
    from users u
    join businesses b on b.id = u.business_id
    where u.auth_user_id = auth.uid()
      and u.active = true
      and b.active = true;

    if not found then
        return false;
    end if;

    if v_role = 'owner' then
        return true;
    end if;

    return p_key = any(staff_role_permissions(v_staff_role) || coalesce(v_extra, '{}'));
end;
$$;

-- Carries the owner's 26 write policies. The cost is that six
-- owner-only READ policies (audit log, change requests, referral
-- screens, assistant history, owner notifications) also go quiet while
-- a shop is suspended. Accepted: those are extras, and the shop's own
-- data, its bill and the subscribe page all read through other
-- policies and stay visible.
create or replace function public.is_business_owner()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from users u
    join businesses b on b.id = u.business_id
    where u.auth_user_id = auth.uid()
      and u.role = 'owner'
      and u.active = true
      and b.active = true
  )
$$;

-- The four write policies that reach none of the three functions above
-- and so were never covered by them.
alter policy shifts_insert on public.shifts
  with check (business_id = get_my_business_id() and my_business_active());

alter policy staff_append_own_events on public.cart_audit_log
  with check (
    business_id = get_my_business_id()
    and my_business_active()
    and user_id = (select id from users where auth_user_id = auth.uid())
  );

alter policy owner_insert_own_business on public.employee_approval_requests
  with check (
    business_id = get_my_business_id()
    and my_business_active()
    and requested_by = (select id from users where auth_user_id = auth.uid())
    and exists (
      select 1 from users
      where auth_user_id = auth.uid() and role = 'owner' and active = true
    )
  );

alter policy owner_cancel_own_pending on public.employee_approval_requests
  using (
    business_id = get_my_business_id()
    and status = 'pending'
    and requested_by = (select id from users where auth_user_id = auth.uid())
  )
  with check (
    business_id = get_my_business_id()
    and my_business_active()
    and status = 'cancelled'
    and requested_by = (select id from users where auth_user_id = auth.uid())
  );

revoke all on function public.my_business_active() from anon;

-- Verified against live data after applying:
--
--   switched-off cashier  -> business_id NULL, has_permission false,
--                            items/sales/users/expenses/customers/
--                            warehouses all read 0
--   suspended shop owner  -> reads items fine, every write BLOCKED
--                            (categories, items, shifts, draw_stock_fifo)
--   active shop owner     -> unchanged: reads 100 items / 10 users,
--                            insert+delete+update all OK
