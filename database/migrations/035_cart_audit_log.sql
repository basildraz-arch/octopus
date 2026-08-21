-- ==========================================
-- OCTOPUS ERP
-- Cart audit log (Kero item 3 - anti-theft)
--
-- The problem this solves: until now the POS cart lived purely in
-- React state. A cashier could add items, hand the goods over, then
-- delete the lines (or just refresh the page) and NOTHING was written
-- anywhere - no sale row, no trace. The owner had no way to know a
-- transaction had ever been started.
--
-- So the log records the cart itself, not just deletions:
--   add      - a line went into the cart
--   remove   - a line was taken out before checkout
--   checkout - the cart became a real sale (carries sale_id)
--
-- A cart_session_id groups the events of one cart. Any session with
-- 'add' events but no 'checkout' is a basket that was built and never
-- rung up - which is exactly the pattern Kero wants to catch, with a
-- precise timestamp to match against the shop's camera footage.
--
-- APPEND-ONLY BY DESIGN:
-- employees may INSERT and nothing else. They cannot SELECT (so a
-- cashier can't check whether they were caught), and there is no
-- UPDATE or DELETE policy for anyone - a log the watched party can
-- edit is not a log. Owners and platform admins read; nobody writes
-- twice.
-- ==========================================

create table if not exists cart_audit_log (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    user_id uuid not null
        references users(id)
        on delete cascade,

    shift_id uuid
        references shifts(id)
        on delete set null,

    -- groups all events belonging to one cart
    cart_session_id uuid not null,

    action text not null
        check (action in ('add', 'remove', 'checkout')),

    item_id uuid
        references items(id)
        on delete set null,

    -- snapshot: the log must still read correctly years later even if
    -- the item was renamed or deleted from the catalogue
    item_name text,

    quantity numeric,

    unit_price numeric,

    line_total numeric,

    sale_id uuid
        references sales(id)
        on delete set null,

    created_at timestamptz not null default now()

);

create index if not exists idx_cart_audit_business_date
on cart_audit_log(business_id, created_at desc);

create index if not exists idx_cart_audit_session
on cart_audit_log(cart_session_id);

create index if not exists idx_cart_audit_user
on cart_audit_log(user_id, created_at desc);

alter table cart_audit_log enable row level security;

-- Any staff member may append events for themselves, in their own
-- business. user_id is pinned to the caller's own row so one cashier
-- can never write events under another cashier's name.
drop policy if exists "staff_append_own_events" on cart_audit_log;

create policy "staff_append_own_events" on cart_audit_log
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and user_id = (select id from users where auth_user_id = auth.uid())
);

-- Reading is an owner/Master privilege. A cashier deliberately cannot
-- see this table at all.
drop policy if exists "owner_reads_audit" on cart_audit_log;

create policy "owner_reads_audit" on cart_audit_log
for select to authenticated
using (
  (business_id = get_my_business_id() and is_business_owner())
  or is_platform_admin()
);

-- No UPDATE and no DELETE policy is defined on purpose. Even the
-- owner cannot rewrite history from the app; the rows are immutable
-- once written.
