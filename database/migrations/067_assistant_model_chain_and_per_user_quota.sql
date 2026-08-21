-- 067 - حبر الأخطبوط: a chain of free models, and a daily allowance per person.
--
-- Two separate problems that both looked like "the assistant stopped
-- working":
--
--   1. One hardcoded model (lib/gemini.ts). When its free quota ran out
--      for the day the assistant was simply dead until midnight.
--   2. The daily counter was per BUSINESS. Two cashiers and an owner
--      shared one pot, so whoever asked first spent everyone's. Worse,
--      it was charged in two places inside one message and skipped
--      entirely for plain questions, so it never matched reality.
--
-- Basel wants it dependable enough to actually run the shop through -
-- asking questions and giving commands - so the allowance is generous
-- and lives in a table he can raise without a deploy.

create table if not exists ai_models (
    id          uuid primary key default gen_random_uuid(),
    provider    text not null,
    model       text not null,
    label       text not null,
    -- Lower runs first. Strongest at the top, weakest at the bottom.
    rank        integer not null,
    active      boolean not null default true,
    created_at  timestamptz not null default now(),
    unique (provider, model)
);

comment on table ai_models is
  'The fallback chain for the assistant, strongest first. A model that reports its free quota exhausted is skipped for the rest of that day (see ai_model_exhaustion) and the chain starts from the top again tomorrow.';

-- Seeded with Google models only, because that is the one key that
-- already exists. Each model has its own free quota, so falling down
-- this list buys real extra capacity without a new account. Adding
-- Groq or OpenRouter later is a row here plus its key in the
-- environment - lib/ai.ts already speaks both.
insert into ai_models (provider, model, label, rank) values
    ('google', 'gemini-3.5-flash-lite', 'جيميناي 3.5 لايت', 10),
    ('google', 'gemini-2.5-flash',      'جيميناي 2.5',      20),
    ('google', 'gemini-2.5-flash-lite', 'جيميناي 2.5 لايت', 30),
    ('google', 'gemini-2.0-flash',      'جيميناي 2.0',      40),
    ('google', 'gemini-2.0-flash-lite', 'جيميناي 2.0 لايت', 50)
on conflict (provider, model) do nothing;

-- "This model is out of free calls today." Keyed on the date, so the
-- reset is not a job that has to run - tomorrow's date simply has no
-- rows and the whole chain is available from the top again.
create table if not exists ai_model_exhaustion (
    model_id     uuid not null references ai_models(id) on delete cascade,
    usage_date   date not null default current_date,
    noticed_at   timestamptz not null default now(),
    reason       text,
    primary key (model_id, usage_date)
);

comment on table ai_model_exhaustion is
  'One row per model per day, written the first time that model refuses with a quota error. Yesterday''s rows are simply never read again - that is the daily reset.';

create table if not exists assistant_limits (
    id             integer primary key default 1,
    owner_daily    integer not null default 100,
    staff_daily    integer not null default 30,
    updated_at     timestamptz not null default now(),
    constraint assistant_limits_singleton check (id = 1)
);

insert into assistant_limits (id) values (1) on conflict (id) do nothing;

-- Per person, not per shop.
alter table assistant_usage
  add column if not exists user_id uuid references users(id) on delete cascade;

-- The old rows counted a whole business together and cannot be split
-- into people after the fact. They are yesterday's numbers for a
-- counter that has changed meaning, so they go.
delete from assistant_usage where user_id is null;

alter table assistant_usage drop constraint if exists assistant_usage_pkey;
alter table assistant_usage alter column user_id set not null;
alter table assistant_usage add primary key (user_id, usage_date);

-- Spend one message and say what is left.
--
-- Raises rather than returning a count when the person is out, so a
-- caller that forgets to check still cannot overspend. The limit is
-- read per call so raising it in Master takes effect immediately.
create or replace function public.spend_assistant_message()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_user      users%rowtype;
    v_limit     integer;
    v_used      integer;
begin
    select * into v_user from users
    where auth_user_id = auth.uid() and active = true;

    if not found then
        raise exception 'غير مصرّح';
    end if;

    select case when v_user.role = 'owner' then owner_daily else staff_daily end
    into v_limit
    from assistant_limits where id = 1;

    insert into assistant_usage (business_id, user_id, usage_date, gemini_calls)
    values (v_user.business_id, v_user.id, current_date, 1)
    on conflict (user_id, usage_date)
    do update set gemini_calls = assistant_usage.gemini_calls + 1
    returning gemini_calls into v_used;

    if v_used > v_limit then
        raise exception 'خلصت رسايلك النهاردة (% رسالة). جرب بكرة.', v_limit;
    end if;

    return v_limit - v_used;
end;
$$;

-- Replaced by spend_assistant_message(): counted per business and
-- enforced nothing.
drop function if exists public.increment_assistant_usage(uuid);

alter table ai_models            enable row level security;
alter table ai_model_exhaustion  enable row level security;
alter table assistant_limits     enable row level security;

create policy ai_models_read on ai_models
    for select to authenticated using (true);

create policy ai_models_admin on ai_models
    for all to authenticated
    using (is_platform_admin()) with check (is_platform_admin());

create policy assistant_limits_read on assistant_limits
    for select to authenticated using (true);

create policy assistant_limits_admin on assistant_limits
    for all to authenticated
    using (is_platform_admin()) with check (is_platform_admin());

create policy ai_model_exhaustion_admin on ai_model_exhaustion
    for select to authenticated using (is_platform_admin());

revoke insert, update, delete on ai_model_exhaustion from authenticated, anon;

-- subscription_started_at belongs with the other two subscription
-- columns the trigger already guards - otherwise a shop could rewrite
-- when its own paid period began.
create or replace function public.protect_subscription_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
    if (new.trial_ends_at is distinct from old.trial_ends_at
        or new.subscription_expires_at is distinct from old.subscription_expires_at
        or new.subscription_started_at is distinct from old.subscription_started_at)
       and auth.role() != 'service_role' then
        raise exception 'غير مسموح بتعديل بيانات الاشتراك مباشرة';
    end if;
    return new;
end;
$$;
