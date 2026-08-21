-- ==========================================
-- OCTOPUS ERP
-- Migration 052: narrow two read policies after testing them
--
-- Migrations 049 and 051 let anyone inside the business read
-- change_requests and assistant_actions. Verified against live data
-- that a cashier could therefore see "the owner asked to turn on
-- multi-warehouse" and every instruction the owner had given the
-- assistant.
--
-- Neither is a privilege escalation, and neither was reachable from
-- any screen a cashier can open - but both are the owner's business
-- with the platform, not the shop floor's. The pattern that produced
-- the four real holes in migration 044 was exactly this: a policy
-- written as "anyone in the business" when the answer was "the owner".
-- ==========================================

drop policy if exists change_requests_read on change_requests;

create policy change_requests_read on change_requests
for select to authenticated
using (
  (business_id = get_my_business_id() and is_business_owner())
  or is_platform_admin()
);

drop policy if exists assistant_actions_read on assistant_actions;

create policy assistant_actions_read on assistant_actions
for select to authenticated
using (
  (business_id = get_my_business_id() and is_business_owner())
  or is_platform_admin()
);
