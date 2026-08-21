-- 066 - The subscription now ends by itself.
--
-- Until this, businesses.active was the only gate and it only ever
-- moved when somebody clicked it in Master. A shop that stopped paying
-- kept selling until Basel noticed. The trial was worse: seven days was
-- a default on a column nothing ever read.
--
-- No scheduled job, deliberately. A cron that flips a flag is one more
-- thing that can silently stop running, and the day it does, every
-- expired shop is open again. The date is evaluated live inside the
-- same functions every policy already calls, so "expired" is a fact
-- about now() rather than a flag somebody has to maintain.
--
-- Decided with Basel: closes on the expiry day itself, with a warning
-- shown for the week before it (components/layout/SuspendedBanner.tsx).

alter table businesses
  add column if not exists subscription_started_at timestamptz;

update businesses
set subscription_started_at = created_at
where subscription_started_at is null;

comment on column businesses.subscription_started_at is
  'When the current paid period began. Set by the payment webhook on every successful renewal; the expiry is what actually gates access.';

create or replace function public.subscription_open(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from businesses b
    where b.id = p_business_id
      and (
        (b.subscription_expires_at is not null and b.subscription_expires_at > now())
        or (b.subscription_expires_at is null and b.trial_ends_at > now())
      )
  )
$$;

comment on function public.subscription_open(uuid) is
  'True while the shop is paid up or inside its trial. Evaluated live - there is no job that marks shops expired.';

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
      and (
        (b.subscription_expires_at is not null and b.subscription_expires_at > now())
        or (b.subscription_expires_at is null and b.trial_ends_at > now())
      )
  )
$$;

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
      and b.active = true
      and (
        (b.subscription_expires_at is not null and b.subscription_expires_at > now())
        or (b.subscription_expires_at is null and b.trial_ends_at > now())
      );

    if not found then
        return false;
    end if;

    if v_role = 'owner' then
        return true;
    end if;

    return p_key = any(staff_role_permissions(v_staff_role) || coalesce(v_extra, '{}'));
end;
$$;

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
      and (
        (b.subscription_expires_at is not null and b.subscription_expires_at > now())
        or (b.subscription_expires_at is null and b.trial_ends_at > now())
      )
  )
$$;

revoke all on function public.subscription_open(uuid) from anon;

-- Verified against live data after applying:
--
--   no existing shop changed state - the two active ones still write,
--   the three switched off in Master stay closed
--
--   expiry moved to yesterday on the test shop:
--     my_business_active false, has_permission false,
--     is_business_owner false, reads still return 100 items,
--     insert category BLOCKED, draw_stock_fifo BLOCKED
--   then restored to 2100-03-03
