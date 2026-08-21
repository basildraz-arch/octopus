-- Supabase's default privileges auto-grant EXECUTE on new functions
-- to anon directly (not through PUBLIC), so the "revoke all from
-- public" in migration 031 didn't actually remove anon's access.
-- is_platform_admin() underlies every Master-tier security check
-- in the app, so lock it down explicitly rather than leaving it
-- reachable by unauthenticated callers.

revoke execute on function is_platform_admin() from anon;
revoke execute on function is_platform_admin() from public;
grant execute on function is_platform_admin() to authenticated;
grant execute on function is_platform_admin() to service_role;
