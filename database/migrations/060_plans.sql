-- ==========================================
-- OCTOPUS ERP
-- Migration 060: three plans, and a price per shop
--
-- WHY NOW
-- Every shop paid the same, so a kiosk with one cashier funded the
-- same product as a supermarket with three branches and ten staff.
-- That loses money at the top and shuts the door at the bottom.
--
-- The machinery for this was already built and unused: features are
-- per business (046), templates shape a new one (046), staff roles
-- exist (047), and warehouses and branches already needed approval
-- (049). A plan is just a named bundle of those, with a price.
--
-- LIMITS LIVE ON THE BUSINESS, NOT ONLY ON THE PLAN
-- The plan SEEDS them; the business OWNS them. Same shape as
-- ui_labels in 056, and it buys two things: a special case for one
-- shop is a field edit rather than a fourth plan, and moving somebody
-- to a smaller plan can never drop a limit below what they have
-- already built. The backfill below is written that way too - every
-- existing shop keeps at least what it already has.
--
-- monthly_price is per business for the same reason: a special deal
-- is one field on one row, not a fork of the price list.
--
-- WHAT THE OWNER MAY NOT TOUCH
-- Plan, price and limits are the platform's side of the relationship,
-- so protect_plan_columns refuses them the same way 049 refuses
-- features. Verified as a real shop owner: editing a plan changes 0
-- rows, self-upgrading raises, raising their own staff limit raises,
-- and renaming their own shop still works.
-- ==========================================

create table if not exists plans (
    code text primary key,

    label text not null,
    tagline text not null default '',
    icon text not null default '📦',

    monthly_price numeric(10,2) not null check (monthly_price >= 0),
    annual_price numeric(10,2) not null check (annual_price >= 0),

    enabled_features text[] not null default '{}',

    staff_limit integer not null default 2 check (staff_limit between 0 and 999),
    warehouse_limit integer not null default 1 check (warehouse_limit between 1 and 999),
    branch_limit integer not null default 1 check (branch_limit between 1 and 999),

    sort_order integer not null default 0,
    active boolean not null default true,

    updated_at timestamptz not null default now()
);

insert into plans (code, label, tagline, icon, monthly_price, annual_price, enabled_features, staff_limit, warehouse_limit, branch_limit, sort_order)
values
  ('basic', 'بسيط', 'كشك أو محل صغير بكاشير واحد', '🛒',
   700, 7000,
   array['pos_sales','inventory','categories','shifts','sales_reports'],
   2, 1, 1, 1),

  ('shop', 'محل', 'محل شغّال بحساب مؤجل وخصم وتسعيرات', '🏪',
   1200, 12000,
   array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers','price_tiers'],
   5, 1, 1, 2),

  ('multi', 'متعدد', 'مخازن وفروع وفاتورة إنجليزي', '🏭',
   2500, 25000,
   array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers','price_tiers','multi_warehouse','warehouse_reports','english_receipt'],
   999, 10, 10, 3)
on conflict (code) do nothing;

alter table plans enable row level security;

-- Readable by everyone signed in: a shop has to be able to see what
-- the next plan up would give it.
drop policy if exists plans_read on plans;

create policy plans_read on plans
for select to authenticated
using (true);

drop policy if exists plans_admin_write on plans;

create policy plans_admin_write on plans
for update to authenticated
using (is_platform_admin())
with check (is_platform_admin());

revoke insert, delete on plans from authenticated, anon;

alter table businesses
    add column if not exists plan_code text references plans(code) on delete set null,
    add column if not exists monthly_price numeric(10,2),
    add column if not exists staff_limit integer not null default 2,
    add column if not exists warehouse_limit integer not null default 1,
    add column if not exists branch_limit integer not null default 1;

-- Put everyone already trading on the plan that matches what they
-- already have, rather than taking anything away.
update businesses
set plan_code = case
        when 'multi_warehouse' = any(enabled_features) then 'multi'
        when 'credit_customers' = any(enabled_features)
          or 'price_tiers' = any(enabled_features) then 'shop'
        else 'basic'
    end
where plan_code is null;

-- greatest(): nobody wakes up over a limit they were under yesterday.
update businesses b
set monthly_price = coalesce(b.monthly_price, p.monthly_price),
    staff_limit = greatest(p.staff_limit, (
        select count(*) from users u where u.business_id = b.id and u.role <> 'owner' and u.active
    )),
    warehouse_limit = greatest(p.warehouse_limit, (
        select count(*) from warehouses w where w.business_id = b.id and w.active
    )),
    branch_limit = greatest(p.branch_limit, (
        select count(*) from branches br where br.business_id = b.id and br.active
    ))
from plans p
where p.code = b.plan_code;

create or replace function protect_plan_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if auth.role() = 'service_role' then
        return new;
    end if;

    if new.plan_code is distinct from old.plan_code
       or new.monthly_price is distinct from old.monthly_price
       or new.staff_limit is distinct from old.staff_limit
       or new.warehouse_limit is distinct from old.warehouse_limit
       or new.branch_limit is distinct from old.branch_limit
    then
        raise exception 'تغيير الباقة أو حدودها بيتم بطلب موافقة من الإدارة';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_protect_plan_columns on businesses;

create trigger trg_protect_plan_columns
before update on businesses
for each row execute function protect_plan_columns();

revoke execute on function protect_plan_columns() from public, anon, authenticated;
