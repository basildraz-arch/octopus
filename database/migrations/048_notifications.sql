-- ==========================================
-- OCTOPUS ERP
-- Migration 048: in-app notifications
--
-- WHY THIS EXISTS
-- The app knows things the owner doesn't: an item just ran out, a
-- request is waiting for approval, a review came back. Until now the
-- only way to find out was to go and look. A notification is the app
-- tapping the owner on the shoulder instead.
--
-- This is also the pipe the assistant speaks through when it needs to
-- start a conversation rather than answer one.
--
-- SECURITY
-- Nobody writes a notification from the client. Rows are created by
-- SECURITY DEFINER triggers and by server-side code holding the
-- service role. A reader may only mark their own as read - enforced
-- by a trigger, because an UPDATE policy alone cannot say "you may
-- change this column and no other".
-- ==========================================

create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),

    -- Which business this is about. Null only for platform-wide
    -- notices addressed to the platform admin.
    business_id uuid references businesses(id) on delete cascade,

    -- Who should see it.
    audience text not null default 'owner'
        check (audience in ('owner', 'all_staff', 'user', 'platform_admin')),

    -- Set only when audience = 'user'.
    user_id uuid references users(id) on delete cascade,

    kind text not null,
    title text not null,
    body text not null default '',

    -- Where tapping it should take you, e.g. '/items'.
    link text,

    severity text not null default 'info'
        check (severity in ('info', 'warning', 'danger')),

    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists notifications_business_created_idx
    on notifications (business_id, created_at desc);

create index if not exists notifications_unread_idx
    on notifications (business_id, audience)
    where read_at is null;

alter table notifications enable row level security;

drop policy if exists notifications_read on notifications;

create policy notifications_read on notifications
for select to authenticated
using (
  (audience = 'platform_admin' and is_platform_admin())
  or (
    business_id = get_my_business_id()
    and (
      (audience = 'owner' and is_business_owner())
      or audience = 'all_staff'
      or (audience = 'user'
          and user_id = (select id from users where auth_user_id = auth.uid()))
    )
  )
);

-- Marking as read is the only write a client gets.
drop policy if exists notifications_mark_read on notifications;

create policy notifications_mark_read on notifications
for update to authenticated
using (
  (audience = 'platform_admin' and is_platform_admin())
  or (
    business_id = get_my_business_id()
    and (
      (audience = 'owner' and is_business_owner())
      or audience = 'all_staff'
      or (audience = 'user'
          and user_id = (select id from users where auth_user_id = auth.uid()))
    )
  )
)
with check (true);

create or replace function protect_notification_columns()
returns trigger
language plpgsql
as $$
begin
    if auth.role() = 'service_role' then
        return new;
    end if;

    if new.id is distinct from old.id
       or new.business_id is distinct from old.business_id
       or new.audience is distinct from old.audience
       or new.user_id is distinct from old.user_id
       or new.kind is distinct from old.kind
       or new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.link is distinct from old.link
       or new.severity is distinct from old.severity
       or new.created_at is distinct from old.created_at
    then
        raise exception 'التنبيه مينفعش يتعدل - تقدر تعلّمه كمقروء بس';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_protect_notification_columns on notifications;

create trigger trg_protect_notification_columns
before update on notifications
for each row execute function protect_notification_columns();

-- No INSERT and no DELETE policy at all: the client cannot invent a
-- notification, and cannot make one disappear.

-- ------------------------------------------
-- The one way rows get created
-- ------------------------------------------
create or replace function notify(
    p_business_id uuid,
    p_audience text,
    p_kind text,
    p_title text,
    p_body text default '',
    p_link text default null,
    p_severity text default 'info',
    p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    insert into notifications
        (business_id, audience, user_id, kind, title, body, link, severity)
    values
        (p_business_id, p_audience, p_user_id, p_kind, p_title, p_body, p_link, p_severity)
    returning id into v_id;

    return v_id;
end;
$$;

revoke execute on function notify(uuid, text, text, text, text, text, text, uuid)
    from public, anon, authenticated;
grant execute on function notify(uuid, text, text, text, text, text, text, uuid)
    to service_role;

-- ------------------------------------------
-- Trigger: an item just ran low
-- ------------------------------------------
create or replace function notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not new.has_stock or coalesce(new.minimum_stock, 0) <= 0 then
        return new;
    end if;

    -- Only on the crossing, so a shop that sells ten more of an
    -- already-low item doesn't get ten notifications.
    if new.stock <= new.minimum_stock and old.stock > old.minimum_stock then
        perform notify(
            new.business_id,
            'owner',
            'low_stock',
            new.name || ' قرب يخلص',
            'فاضل ' || trim(to_char(new.stock, 'FM999999990.00')) || ' بس',
            '/items',
            'warning'
        );
    end if;

    return new;
end;
$$;

drop trigger if exists trg_notify_low_stock on items;

create trigger trg_notify_low_stock
after update of stock on items
for each row execute function notify_low_stock();

-- ------------------------------------------
-- Trigger: a new employee request is waiting
-- ------------------------------------------
create or replace function notify_employee_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_business_name text;
begin
    select name into v_business_name from businesses where id = new.business_id;

    perform notify(
        new.business_id,
        'platform_admin',
        'employee_request',
        'طلب موظف جديد من ' || coalesce(v_business_name, 'نشاط'),
        coalesce(new.full_name, '') || ' مستني الموافقة',
        '/employee-requests',
        'info'
    );

    return new;
end;
$$;

drop trigger if exists trg_notify_employee_request on employee_approval_requests;

create trigger trg_notify_employee_request
after insert on employee_approval_requests
for each row execute function notify_employee_request();
