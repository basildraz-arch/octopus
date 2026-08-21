-- ==========================================
-- OCTOPUS ERP
-- Migration 049: owner changes that need platform approval
--
-- WHY THIS EXISTS
-- A business owner runs their own shop day to day - prices, items,
-- staff PINs, receipts, the shop's name. But a handful of changes
-- reshape the product itself, and those come back to the platform
-- admin first:
--
--   * turning an app feature on or off
--   * switching the business to a different type (a new template)
--   * adding a second warehouse or a second branch
--
-- HOW IT IS ENFORCED
-- Not by hiding a button. Three triggers below refuse the write
-- outright unless it arrives holding the service role, which only
-- server-side code past a real is_platform_admin() check ever does.
-- The owner's route is a change_request row; approving it runs the
-- change through the API, where the admin check lives.
--
-- The first warehouse and the first branch are exempt - every
-- business gets one at signup, and a shop with a single stock
-- location is not asking for anything.
--
-- Employee approval requests (migration 032) already worked this way;
-- they gain staff_role here so the owner picks what the new person
-- will be allowed to do at the moment they ask for them.
-- ==========================================

alter table employee_approval_requests
    add column if not exists staff_role text not null default 'cashier';

alter table employee_approval_requests
    drop constraint if exists employee_approval_requests_staff_role_check;

alter table employee_approval_requests
    add constraint employee_approval_requests_staff_role_check
    check (staff_role in ('cashier', 'stock_keeper', 'manager'));

alter table employee_approval_requests
    add column if not exists extra_permissions text[] not null default '{}';

create table if not exists change_requests (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references businesses(id) on delete cascade,
    requested_by uuid references users(id) on delete set null,

    kind text not null check (kind in (
        'enable_feature', 'disable_feature', 'change_business_type',
        'add_warehouse', 'add_branch', 'other'
    )),

    payload jsonb not null default '{}',
    note text not null default '',

    status text not null default 'pending'
        check (status in ('pending', 'approved', 'rejected', 'cancelled')),

    reviewed_by uuid references platform_admins(id) on delete set null,
    reviewed_at timestamptz,
    review_note text,

    created_at timestamptz not null default now()
);

create index if not exists change_requests_pending_idx
    on change_requests (status, created_at desc);

create index if not exists change_requests_business_idx
    on change_requests (business_id, created_at desc);

alter table change_requests enable row level security;

drop policy if exists change_requests_read on change_requests;

create policy change_requests_read on change_requests
for select to authenticated
using (business_id = get_my_business_id() or is_platform_admin());

-- The owner may ask, pinned to their own identity and to 'pending'.
drop policy if exists change_requests_owner_insert on change_requests;

create policy change_requests_owner_insert on change_requests
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and is_business_owner()
  and status = 'pending'
  and reviewed_by is null
  and requested_by = (select id from users where auth_user_id = auth.uid())
);

-- ...and may take it back, and nothing else.
drop policy if exists change_requests_owner_cancel on change_requests;

create policy change_requests_owner_cancel on change_requests
for update to authenticated
using (business_id = get_my_business_id() and is_business_owner() and status = 'pending')
with check (business_id = get_my_business_id() and status = 'cancelled');

create or replace function protect_change_request_columns()
returns trigger
language plpgsql
as $$
begin
    if auth.role() = 'service_role' then
        return new;
    end if;

    if new.kind is distinct from old.kind
       or new.payload is distinct from old.payload
       or new.business_id is distinct from old.business_id
       or new.requested_by is distinct from old.requested_by
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.review_note is distinct from old.review_note
    then
        raise exception 'الطلب مينفعش يتعدل بعد ما يتبعت';
    end if;

    if new.status not in ('pending', 'cancelled') then
        raise exception 'الموافقة أو الرفض من حساب الإدارة بس';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_protect_change_request_columns on change_requests;

create trigger trg_protect_change_request_columns
before update on change_requests
for each row execute function protect_change_request_columns();

create or replace function notify_change_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_business_name text;
begin
    select name into v_business_name from businesses where id = new.business_id;

    if tg_op = 'INSERT' then
        perform notify(
            new.business_id, 'platform_admin', 'change_request',
            'طلب تعديل من ' || coalesce(v_business_name, 'نشاط'),
            new.note, '/master', 'info'
        );

        return new;
    end if;

    if new.status is distinct from old.status
       and new.status in ('approved', 'rejected') then
        perform notify(
            new.business_id, 'owner', 'change_request_reviewed',
            case when new.status = 'approved' then 'طلبك اتوافق عليه' else 'طلبك اترفض' end,
            coalesce(new.review_note, new.note), '/settings',
            case when new.status = 'approved' then 'info' else 'warning' end
        );
    end if;

    return new;
end;
$$;

drop trigger if exists trg_notify_change_request_insert on change_requests;

create trigger trg_notify_change_request_insert
after insert on change_requests
for each row execute function notify_change_request();

drop trigger if exists trg_notify_change_request_update on change_requests;

create trigger trg_notify_change_request_update
after update on change_requests
for each row execute function notify_change_request();

-- ------------------------------------------
-- The three locks
-- ------------------------------------------
create or replace function protect_subscription_and_feature_columns()
returns trigger
language plpgsql
as $$
begin
    if auth.role() = 'service_role' then
        return new;
    end if;

    if new.enabled_features is distinct from old.enabled_features
       or new.business_type is distinct from old.business_type
       or new.app_mode is distinct from old.app_mode
    then
        raise exception 'تغيير مميزات البرنامج أو نوع النشاط بيتم بطلب موافقة من الإدارة';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_protect_business_features on businesses;

create trigger trg_protect_business_features
before update on businesses
for each row execute function protect_subscription_and_feature_columns();

create or replace function guard_extra_warehouse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
begin
    if auth.role() = 'service_role' then
        return new;
    end if;

    select count(*) into v_count from warehouses where business_id = new.business_id;

    if v_count > 0 then
        raise exception 'إضافة مخزن جديد بيتم بطلب موافقة من الإدارة';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_guard_extra_warehouse on warehouses;

create trigger trg_guard_extra_warehouse
before insert on warehouses
for each row execute function guard_extra_warehouse();

create or replace function guard_extra_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
begin
    if auth.role() = 'service_role' then
        return new;
    end if;

    select count(*) into v_count from branches where business_id = new.business_id;

    if v_count > 0 then
        raise exception 'إضافة فرع جديد بيتم بطلب موافقة من الإدارة';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_guard_extra_branch on branches;

create trigger trg_guard_extra_branch
before insert on branches
for each row execute function guard_extra_branch();
