-- ==========================================
-- OCTOPUS ERP
-- User Activity Log (personal tool, not a business feature)
--
-- Coarse activity tracking: a row per meaningful action (login,
-- sale completed, item created/updated) - not every click. The
-- daily "activity range" for a user is derived as
-- (last row of the day - first row of the day), computed at read
-- time, not stored.
--
-- Every business owner can see their own business's activity log
-- (same isolation as everything else), plus a single hardcoded
-- exception: basildraz@gmail.com can read across every business.
-- This is a personal cross-business admin view, not a general
-- feature - if that email ever changes, this policy needs a new
-- migration to match.
-- ==========================================

create table if not exists user_activity_log (

    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references users(id)
        on delete cascade,

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    created_at timestamptz not null default now()

);

create index if not exists idx_activity_log_user_date
on user_activity_log(user_id, created_at);

alter table user_activity_log enable row level security;

drop policy if exists "insert_own_activity" on user_activity_log;

create policy "insert_own_activity" on user_activity_log
for insert to authenticated
with check (
  user_id = (select id from users where auth_user_id = auth.uid())
);

drop policy if exists "read_activity" on user_activity_log;

create policy "read_activity" on user_activity_log
for select to authenticated
using (
  business_id = get_my_business_id()
  or exists (
    select 1 from users
    where users.auth_user_id = auth.uid()
    and users.email = 'basildraz@gmail.com'
  )
);
