-- ==========================================
-- OCTOPUS ERP
-- Paid subscriptions via Paymob (7-day free trial, soft lock after)
--
-- Subscription state lives as two dates on businesses, not a stored
-- status column - "locked" is always computed live from
-- trial_ends_at/subscription_expires_at vs now(), so there's no
-- separate cache that can drift out of sync with the real dates.
--
-- Both columns are writable ONLY by the service_role (see the
-- trigger below) - a business owner can update the rest of their
-- own business row (name, max_discount_percent, ...) via the normal
-- client, but never these two, since that would let them grant
-- themselves free access. Only the Paymob webhook (running
-- server-side with the service_role key, after verifying the
-- request's HMAC signature) is allowed to touch them.
-- ==========================================

alter table businesses
    add column if not exists trial_ends_at timestamptz;

alter table businesses
    add column if not exists subscription_expires_at timestamptz;

-- Grandfather every business that already existed before this
-- migration (Medo, Sameh, Ibrahim, Basil, any earlier /signup test
-- accounts) - they keep full access indefinitely. Only businesses
-- signing up through /signup from now on go through the real
-- 7-day trial (set explicitly by complete_signup(), next migration)
-- followed by the paywall.
update businesses
set subscription_expires_at = '2099-12-31'::timestamptz
where created_at < now()
and subscription_expires_at is null;

update businesses
set trial_ends_at = '2099-12-31'::timestamptz
where trial_ends_at is null;

alter table businesses
    alter column trial_ends_at set not null;

-- sensible fallback for any future insert that doesn't go through
-- complete_signup() (e.g. a manual business created directly in
-- Supabase, same as business_type is set manually today)
alter table businesses
    alter column trial_ends_at set default (now() + interval '7 days');

-- ==========================================
-- business_is_active(): the single source of truth for "can this
-- business create new records right now". Used both in RLS (below)
-- and mirrored client-side for UI messaging.
-- ==========================================

create or replace function business_is_active(p_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select
        trial_ends_at >= now()
        or (subscription_expires_at is not null and subscription_expires_at >= now())
    from businesses
    where id = p_business_id
$$;

-- ==========================================
-- Payment history - read-only from the client. Every write (success
-- or failure) comes from the webhook via service_role, which
-- bypasses RLS entirely, so no insert/update policy is granted to
-- authenticated users at all.
-- ==========================================

create table if not exists subscription_payments (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    paymob_transaction_id text not null unique,

    paymob_order_id text,

    amount_cents integer not null,

    currency text not null default 'EGP',

    status text not null
        check (status in ('pending', 'success', 'failed')),

    raw_payload jsonb not null,

    created_at timestamptz not null default now()

);

create index if not exists idx_subscription_payments_business
on subscription_payments(business_id);

alter table subscription_payments enable row level security;

drop policy if exists "business_isolation_read" on subscription_payments;

create policy "business_isolation_read" on subscription_payments
for select to authenticated
using (business_id = get_my_business_id());

-- ==========================================
-- Protect trial_ends_at / subscription_expires_at from being changed
-- by anyone other than the service_role (the webhook).
-- ==========================================

create or replace function protect_subscription_columns()
returns trigger
language plpgsql
as $$
begin
    if (new.trial_ends_at is distinct from old.trial_ends_at
        or new.subscription_expires_at is distinct from old.subscription_expires_at)
       and auth.role() != 'service_role' then
        raise exception 'غير مسموح بتعديل بيانات الاشتراك مباشرة';
    end if;

    return new;
end;
$$;

drop trigger if exists protect_subscription_columns_trigger on businesses;

create trigger protect_subscription_columns_trigger
before update on businesses
for each row
execute function protect_subscription_columns();

-- ==========================================
-- Locked businesses can still read everything (reports, items,
-- past sales) - only creating NEW sales/purchases/items is blocked.
-- These are additional RESTRICTIVE policies layered on top of the
-- existing business_isolation policies (which stay untouched), so
-- select/update/delete behavior is unaffected.
-- ==========================================

drop policy if exists "require_active_subscription" on items;

create policy "require_active_subscription" on items
as restrictive
for insert to authenticated
with check (business_is_active(business_id));

drop policy if exists "require_active_subscription" on sales;

create policy "require_active_subscription" on sales
as restrictive
for insert to authenticated
with check (business_is_active(business_id));

drop policy if exists "require_active_subscription" on sale_items;

create policy "require_active_subscription" on sale_items
as restrictive
for insert to authenticated
with check (
    business_is_active(
        (select business_id from sales where sales.id = sale_id)
    )
);

drop policy if exists "require_active_subscription" on purchases;

create policy "require_active_subscription" on purchases
as restrictive
for insert to authenticated
with check (business_is_active(business_id));
