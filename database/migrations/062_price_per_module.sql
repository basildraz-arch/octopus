-- ==========================================
-- OCTOPUS ERP
-- Migration 062: the bill takes the shape of the shop
--
-- THIS REPLACES THE THREE PLANS FROM MIGRATION 060, AND WHY
-- docs/OCTOPUS_CORE.md: "Business Type changes the experience only.
-- It never limits Products or Services." / "Never build for one
-- business only. Always build for every business."
-- docs/ARCHITECTURE.md: "Every feature is isolated."
--
-- Tiers broke both rules. A tier is a box, and a box decides for the
-- shop instead of following it: a café that wants one thing out of
-- the top tier had to buy warehouses and English receipts it will
-- never open, and a kiosk that needed one extra module had to jump a
-- whole step to get it. Every other part of this system bends to the
-- business. Pricing was the one place still bending the business to
-- us - which is exactly backwards, and it was caught by reading the
-- project's own charter back to it.
--
-- So the price is built the way the app is: module by module. Every
-- feature is isolated, so every feature carries its own price, set by
-- what it does and what that is worth in the market. Seats,
-- warehouses and branches are counted the same way.
--
--   bill = base + Σ(modules the shop switched on) + extra seats
--
-- Add one module, the bill moves by exactly that module. Nothing
-- else changes, and nothing arrives that nobody asked for.
--
-- WHAT THE NUMBERS DO IN PRACTICE
-- On live data this lands a plain shop at 925, a shop with a second
-- warehouse at 1,025, and a full multi-branch shop at 1,475 - a
-- spread that is derived rather than assigned, and it puts the common
-- five-module shop at about a thousand.
--
-- businesses.monthly_price survives as an OVERRIDE only. NULL means
-- "work it out from the shop". A special deal is one number on one
-- row, never a fork of the price list.
-- ==========================================

create table if not exists feature_prices (
    feature_key text primary key,

    monthly_price numeric(10,2) not null default 0 check (monthly_price >= 0),

    -- The app itself. Always on, never a line on the bill of its own.
    in_base boolean not null default false,

    sort_order integer not null default 0,
    updated_at timestamptz not null default now()
);

insert into feature_prices (feature_key, monthly_price, in_base, sort_order) values
  ('pos_sales',         0,   true,  1),
  ('inventory',         0,   true,  2),
  ('categories',        0,   true,  3),
  ('shifts',            100, false, 4),
  ('sales_reports',     150, false, 5),
  ('discounts',         75,  false, 6),
  ('credit_customers',  150, false, 7),
  ('price_tiers',       150, false, 8),
  ('english_receipt',   100, false, 9),
  ('multi_warehouse',   400, false, 10),
  ('warehouse_reports', 150, false, 11)
on conflict (feature_key) do nothing;

create table if not exists pricing_settings (
    id integer primary key default 1 check (id = 1),

    base_price numeric(10,2) not null default 600 check (base_price >= 0),

    included_staff integer not null default 2 check (included_staff >= 0),
    extra_staff_price numeric(10,2) not null default 50 check (extra_staff_price >= 0),

    included_warehouses integer not null default 1 check (included_warehouses >= 1),
    extra_warehouse_price numeric(10,2) not null default 100 check (extra_warehouse_price >= 0),

    included_branches integer not null default 1 check (included_branches >= 1),
    extra_branch_price numeric(10,2) not null default 150 check (extra_branch_price >= 0),

    annual_discount_percent numeric(5,2) not null default 17
        check (annual_discount_percent between 0 and 90),

    updated_at timestamptz not null default now()
);

insert into pricing_settings (id) values (1) on conflict (id) do nothing;

alter table feature_prices enable row level security;
alter table pricing_settings enable row level security;

-- Readable by everyone signed in. A shop must be able to see what a
-- module would cost BEFORE it asks for one - a price you can only
-- learn by requesting it is not a price, it is a negotiation.
drop policy if exists feature_prices_read on feature_prices;

create policy feature_prices_read on feature_prices
for select to authenticated using (true);

drop policy if exists feature_prices_admin_write on feature_prices;

create policy feature_prices_admin_write on feature_prices
for update to authenticated
using (is_platform_admin()) with check (is_platform_admin());

drop policy if exists pricing_settings_read on pricing_settings;

create policy pricing_settings_read on pricing_settings
for select to authenticated using (true);

drop policy if exists pricing_settings_admin_write on pricing_settings;

create policy pricing_settings_admin_write on pricing_settings
for update to authenticated
using (is_platform_admin()) with check (is_platform_admin());

revoke insert, delete on feature_prices from authenticated, anon;
revoke insert, delete on pricing_settings from authenticated, anon;

alter table businesses drop column if exists plan_code;

drop table if exists plans;

comment on column businesses.monthly_price is
  'Override only. NULL means the bill is computed from the shop''s own modules and seats.';

create or replace function protect_plan_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if auth.role() = 'service_role' then
        return new;
    end if;

    if new.monthly_price is distinct from old.monthly_price
       or new.staff_limit is distinct from old.staff_limit
       or new.warehouse_limit is distinct from old.warehouse_limit
       or new.branch_limit is distinct from old.branch_limit
    then
        raise exception 'تغيير حدود الاشتراك أو سعره بيتم بطلب موافقة من الإدارة';
    end if;

    return new;
end;
$$;

revoke execute on function protect_plan_columns() from public, anon, authenticated;
