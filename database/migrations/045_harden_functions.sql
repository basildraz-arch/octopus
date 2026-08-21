-- ==========================================
-- OCTOPUS ERP
-- Security review: function hardening
--
-- Two classes of finding from the database linter, both real but
-- lower severity than the policy holes fixed in 044:
--
-- 1. SECURITY DEFINER functions callable over /rest/v1/rpc/ by anyone
--    - including signed-out visitors. A definer function runs with
--      the privileges of its creator, so anything reachable that way
--      is a small piece of the database handed to the internet.
--      rls_auto_enable() is the worst of them: an admin helper that
--      turns RLS on for tables, exposed as a public endpoint.
--
--    Trigger functions are also listed here. Postgres does not check
--    EXECUTE permission when firing a trigger, so revoking client
--    access costs nothing and removes them from the public API.
--
-- 2. Mutable search_path on the trigger functions written during this
--    project. Low risk as written (they touch no unqualified tables),
--    but a pinned search_path is the difference between "safe" and
--    "safe as long as nobody adds a schema later".
-- ==========================================

-- Nothing signed-out ever needs these.
revoke execute on function get_my_business_id() from anon;
revoke execute on function business_is_active(uuid) from anon;
revoke execute on function complete_signup() from anon;

-- Admin/trigger helpers: no client role needs to call them at all.
revoke all on function rls_auto_enable() from anon, authenticated, public;
revoke all on function delete_employee_auth_user() from anon, authenticated, public;

-- Pin search_path on every function this project added or touched.
alter function protect_user_identity_columns() set search_path = public;
alter function protect_employee_email_code() set search_path = public;
alter function protect_item_pricing_columns() set search_path = public;
alter function protect_subscription_columns() set search_path = public;
alter function increment_assistant_usage(uuid) set search_path = public;
