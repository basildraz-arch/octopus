-- ==========================================
-- OCTOPUS ERP
-- Atomic increment for the daily assistant Gemini usage counter
--
-- PostgREST upsert (via the JS client) can only write literal values,
-- not "current value + 1" - that needs to happen inside Postgres to
-- stay atomic under concurrent requests. No SECURITY DEFINER here on
-- purpose: it runs as the caller, so the existing business_isolation
-- RLS policy on assistant_usage still applies as an extra safety net.
-- ==========================================

create or replace function increment_assistant_usage(p_business_id uuid)
returns int
language sql
as $$
  insert into assistant_usage (business_id, usage_date, gemini_calls)
  values (p_business_id, current_date, 1)
  on conflict (business_id, usage_date)
  do update set gemini_calls = assistant_usage.gemini_calls + 1
  returning gemini_calls;
$$;

grant execute on function increment_assistant_usage(uuid) to authenticated;
