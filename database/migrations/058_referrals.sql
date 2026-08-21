-- ==========================================
-- OCTOPUS ERP
-- Migration 058: who sent who, and what they earned for it
--
-- TWO PROGRAMMES, NOT ONE
-- A shop owner who tells his friend, and a marketer working for
-- commission, are different people with different needs. The shop
-- gets its reward as a DISCOUNT on its own bill - money that never
-- leaves, and that makes leaving expensive. The marketer has no bill
-- to discount, so they get cash. Same table, different `kind`.
--
-- THE TWELVE MONTHS START ON THE FIRST REAL PAYMENT
-- Not at signup, and not during the free trial. This is the whole
-- anti-abuse story: a referral that has not produced revenue produces
-- no reward, so inventing shops earns nothing. qualify_referral_on_payment()
-- is what starts the clock, and it fires on the subscription date
-- moving into the future - which covers both a Paymob payment and the
-- platform admin extending a subscription by hand.
--
-- A SHOP THAT STOPS PAYING STOPS EARNING
-- Deliberately not a status column. Whether a referral is earning
-- this month is computed at read time from three live facts: it
-- qualified, it is inside its window, and the referred shop is still
-- active and still paid up. Nothing has to run on a schedule to
-- notice that a shop churned.
--
-- WHY THE REWARD IS ON THE CODE, NOT IN THE CODE
-- monthly_reward and reward_months live per code, so a different deal
-- for one marketer is a field, not a migration.
--
-- Verified against live data, end to end:
--   * signup with a referrer's code records the referral
--   * qualified_at stays NULL until the shop actually pays
--   * paying sets a 365-day window
--   * a shop cannot refer itself
--   * a referrer cannot raise their own reward, insert a referral,
--     mint a code, fake a payout, or extend their own window
--   * the referred shop's owner cannot see the programme at all
--   * a cashier sees nothing
-- ==========================================

create table if not exists referral_codes (
    id uuid primary key default gen_random_uuid(),

    code text not null unique,

    kind text not null check (kind in ('customer', 'marketer')),

    business_id uuid references businesses(id) on delete cascade,

    holder_name text not null,
    holder_phone text,

    monthly_reward numeric(10,2) not null default 300 check (monthly_reward >= 0),
    reward_months integer not null default 12 check (reward_months between 1 and 60),

    active boolean not null default true,
    notes text,

    created_at timestamptz not null default now(),
    created_by uuid references platform_admins(id) on delete set null,

    -- A shop's code belongs to a shop; a marketer's must not, or the
    -- discount has no bill to come off.
    constraint referral_codes_holder_check check (
        (kind = 'customer' and business_id is not null)
        or (kind = 'marketer' and business_id is null)
    )
);

create index if not exists referral_codes_business_idx on referral_codes (business_id);

create table if not exists referrals (
    id uuid primary key default gen_random_uuid(),

    referral_code_id uuid not null references referral_codes(id) on delete cascade,

    -- UNIQUE: one referrer per shop, fixed at signup. Attribution
    -- that can be reassigned later is attribution worth arguing over.
    referred_business_id uuid not null unique references businesses(id) on delete cascade,

    qualified_at timestamptz,
    reward_ends_at timestamptz,

    created_at timestamptz not null default now()
);

create index if not exists referrals_code_idx on referrals (referral_code_id);

create table if not exists referral_payouts (
    id uuid primary key default gen_random_uuid(),

    referral_code_id uuid not null references referral_codes(id) on delete cascade,

    amount numeric(10,2) not null check (amount > 0),
    period_label text not null default '',
    note text,

    paid_at timestamptz not null default now(),
    recorded_by uuid references platform_admins(id) on delete set null
);

create index if not exists referral_payouts_code_idx on referral_payouts (referral_code_id, paid_at desc);

create or replace function block_self_referral()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_owner uuid;
begin
    select business_id into v_owner from referral_codes where id = new.referral_code_id;

    if v_owner is not null and v_owner = new.referred_business_id then
        raise exception 'المحل مينفعش يرشّح نفسه';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_block_self_referral on referrals;

create trigger trg_block_self_referral
before insert or update on referrals
for each row execute function block_self_referral();

create or replace function qualify_referral_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.subscription_expires_at is not null
       and new.subscription_expires_at > now()
       and (old.subscription_expires_at is null or old.subscription_expires_at <= now())
    then
        update referrals r
        set qualified_at = now(),
            reward_ends_at = now() + make_interval(months => c.reward_months)
        from referral_codes c
        where c.id = r.referral_code_id
          and r.referred_business_id = new.id
          and r.qualified_at is null;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_qualify_referral on businesses;

create trigger trg_qualify_referral
after update on businesses
for each row execute function qualify_referral_on_payment();

alter table referral_codes enable row level security;
alter table referrals enable row level security;
alter table referral_payouts enable row level security;

-- A referrer sees their own code and the shops it brought. Nobody
-- else in their shop sees any of it, and the referred shop never sees
-- that it is earning somebody money.
drop policy if exists referral_codes_read on referral_codes;

create policy referral_codes_read on referral_codes
for select to authenticated
using (
  is_platform_admin()
  or (business_id = get_my_business_id() and is_business_owner())
);

drop policy if exists referrals_read on referrals;

create policy referrals_read on referrals
for select to authenticated
using (
  is_platform_admin()
  or referral_code_id in (
    select id from referral_codes
    where business_id = get_my_business_id() and is_business_owner()
  )
);

drop policy if exists referral_payouts_read on referral_payouts;

create policy referral_payouts_read on referral_payouts
for select to authenticated
using (is_platform_admin());

-- No client writes anywhere in the programme.
revoke insert, update, delete on referral_codes from authenticated, anon;
revoke insert, update, delete on referrals from authenticated, anon;
revoke insert, update, delete on referral_payouts from authenticated, anon;

revoke execute on function block_self_referral() from public, anon, authenticated;
revoke execute on function qualify_referral_on_payment() from public, anon, authenticated;
