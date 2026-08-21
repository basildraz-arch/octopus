-- ==========================================
-- OCTOPUS ERP
-- Migration 051: what the assistant proposed, and what it did
--
-- The assistant can now carry out instructions, not just answer
-- questions. Two rules shape this table:
--
--   1. NOTHING happens without the owner pressing "نفّذ". The
--      assistant writes a proposal here, in Arabic, saying exactly
--      what it would change and how many rows it would touch. The
--      execute call names that row by id.
--
--   2. The execution itself runs on the OWNER'S OWN session, not on
--      the service role. So the assistant can never do anything the
--      owner could not do by hand - every RLS policy and every
--      column-guard trigger written in migrations 044 and 047 still
--      applies to it, unchanged.
--
-- The table itself is an append-only record from the client's point
-- of view: it can read its own business's history and nothing else.
-- Rows are written by the API route holding the service role, so a
-- proposal cannot be invented, edited, or made to disappear from the
-- browser.
-- ==========================================

create table if not exists assistant_actions (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references businesses(id) on delete cascade,
    created_by uuid references users(id) on delete set null,

    kind text not null check (kind in (
        'set_item_price', 'bulk_price_change', 'create_item',
        'create_category', 'set_minimum_stock', 'set_item_stock'
    )),

    -- Kept so a surprising change can always be traced back to the
    -- sentence that caused it.
    question text not null default '',

    payload jsonb not null default '{}',

    -- The Arabic sentence the owner actually reads before deciding.
    summary text not null default '',

    affected_count integer not null default 0,

    status text not null default 'proposed'
        check (status in ('proposed', 'executed', 'cancelled', 'failed')),

    error text,

    created_at timestamptz not null default now(),
    executed_at timestamptz
);

create index if not exists assistant_actions_business_idx
    on assistant_actions (business_id, created_at desc);

alter table assistant_actions enable row level security;

drop policy if exists assistant_actions_read on assistant_actions;

create policy assistant_actions_read on assistant_actions
for select to authenticated
using (business_id = get_my_business_id() or is_platform_admin());

-- No INSERT, UPDATE or DELETE policy at all.
revoke insert, update, delete on assistant_actions from authenticated, anon;
