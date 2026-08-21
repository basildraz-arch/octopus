-- ==========================================
-- OCTOPUS ERP
-- Migration 055: cleaning up after 046-054
--
-- Four things the database linter and a policy sweep turned up once
-- the new tables were in place. None was reachable from a screen;
-- all four are the kind of thing that becomes reachable later.
--
-- 1) THE ASSISTANT QUOTA WAS SELF-SERVE
--    assistant_usage counted a business's Gemini calls against a
--    daily limit - and the same business owned the row, with a
--    FOR ALL policy on it. Setting gemini_calls back to 0 was one
--    UPDATE away, which makes the limit decorative and the bill
--    someone else's. increment_assistant_usage is now SECURITY
--    DEFINER with its own tenant check, and the client write policy
--    is gone: a shop can read its usage and nothing else.
--    Verified as a real owner: increment works, cross-business
--    increment is refused, UPDATE and DELETE both change 0 rows.
--
-- 2) MUTABLE search_path ON SECURITY-SENSITIVE FUNCTIONS
--    Same fix migration 045 applied to the functions that existed
--    then. A function that resolves table names through whatever
--    search_path the caller happens to have set can be pointed at a
--    different table than the one its author meant.
--
-- 3) TRIGGER FUNCTIONS WERE LISTED AS API ENDPOINTS
--    PostgREST exposes every function in `public`, trigger functions
--    included. Calling one over REST fails - there is no trigger
--    context - but they have no business being callable at all.
--
-- 4) business_is_active() AND get_my_business_id() WERE OPEN TO anon
--    Signed-out callers have no rows and no session; the policies
--    that use these run as signed-in users.
-- ==========================================

create or replace function increment_assistant_usage(p_business_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer;
begin
    if p_business_id is distinct from get_my_business_id() then
        raise exception 'غير مصرّح';
    end if;

    insert into assistant_usage (business_id, usage_date, gemini_calls)
    values (p_business_id, current_date, 1)
    on conflict (business_id, usage_date)
    do update set gemini_calls = assistant_usage.gemini_calls + 1
    returning gemini_calls into v_count;

    return v_count;
end;
$$;

revoke execute on function increment_assistant_usage(uuid) from public, anon;
grant execute on function increment_assistant_usage(uuid) to authenticated, service_role;

drop policy if exists assistant_usage_owner_write on assistant_usage;

alter function protect_user_identity_columns() set search_path = public;
alter function protect_item_pricing_columns() set search_path = public;
alter function protect_notification_columns() set search_path = public;
alter function protect_change_request_columns() set search_path = public;
alter function protect_subscription_and_feature_columns() set search_path = public;
alter function staff_role_permissions(text) set search_path = public;

revoke execute on function notify_low_stock() from public, anon, authenticated;
revoke execute on function notify_employee_request() from public, anon, authenticated;
revoke execute on function notify_change_request() from public, anon, authenticated;
revoke execute on function notify_abandoned_cart() from public, anon, authenticated;
revoke execute on function guard_extra_warehouse() from public, anon, authenticated;
revoke execute on function guard_extra_branch() from public, anon, authenticated;
revoke execute on function protect_user_identity_columns() from public, anon, authenticated;
revoke execute on function protect_item_pricing_columns() from public, anon, authenticated;
revoke execute on function protect_notification_columns() from public, anon, authenticated;
revoke execute on function protect_change_request_columns() from public, anon, authenticated;
revoke execute on function protect_subscription_and_feature_columns() from public, anon, authenticated;

revoke execute on function business_is_active(uuid) from anon;
revoke execute on function get_my_business_id() from anon;
