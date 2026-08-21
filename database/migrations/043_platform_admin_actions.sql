-- ==========================================
-- OCTOPUS ERP
-- Master action log (Basel item 8)
--
-- The Master tier can suspend a business, extend its subscription and
-- change which features it sees. Those are the highest-blast-radius
-- actions in the product: they affect someone else's livelihood, from
-- outside their own account, and the shop owner has no way to see
-- them happen.
--
-- So every one of them is written here first. Not for punishment -
-- for answering "why did my shop stop working last Tuesday" honestly,
-- and for making a stolen Master session reconstructable rather than
-- invisible.
--
-- Append-only for everyone including platform admins: there is no
-- UPDATE or DELETE policy, and no client-side INSERT policy either.
-- Rows arrive only through the service-role API routes that perform
-- the actions, so the log cannot drift from what actually happened.
-- ==========================================

create table if not exists platform_admin_actions (

    id uuid primary key default gen_random_uuid(),

    platform_admin_id uuid not null
        references platform_admins(id)
        on delete cascade,

    -- Kept even if the business is later deleted, so the trail
    -- survives the thing it describes.
    business_id uuid,

    business_name text,

    action text not null,

    -- What changed, before and after.
    details jsonb,

    created_at timestamptz not null default now()

);

create index if not exists idx_platform_admin_actions_date
on platform_admin_actions(created_at desc);

create index if not exists idx_platform_admin_actions_business
on platform_admin_actions(business_id, created_at desc);

alter table platform_admin_actions enable row level security;

-- Platform admins may read the trail (including each other's actions,
-- which is the point of having more than one). Nobody may write to it
-- from a client, and nobody may edit or delete it at all.
drop policy if exists "platform_admins_read_actions" on platform_admin_actions;

create policy "platform_admins_read_actions" on platform_admin_actions
for select to authenticated
using (is_platform_admin());
