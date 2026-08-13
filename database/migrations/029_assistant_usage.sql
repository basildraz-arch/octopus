-- ==========================================
-- OCTOPUS ERP
-- Daily Gemini usage tracking for "الأخطبوط" assistant
--
-- One row per business per day, holding a running count of actual
-- Gemini API calls (classification + freeform answers - never
-- rule-based answers, which cost nothing). The primary key is
-- (business_id, usage_date), so a new day starts a fresh row at
-- zero automatically - no reset job needed.
-- ==========================================

create table if not exists assistant_usage (

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    usage_date date not null default current_date,

    gemini_calls int not null default 0,

    primary key (business_id, usage_date)

);

alter table assistant_usage enable row level security;

drop policy if exists "business_isolation" on assistant_usage;

create policy "business_isolation" on assistant_usage
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());
