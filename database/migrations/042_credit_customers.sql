-- ==========================================
-- OCTOPUS ERP
-- Running tabs / deferred accounts
--
-- Kero's shop runs 24 hours and regulars take drinks through the day,
-- settling once at the end. Recording those as ordinary sales would
-- quietly break the till: the money is not in the drawer yet, so
-- every day-close would show a shortfall the size of the day's tabs.
--
-- Hence a distinct payment method ('credit') that deliberately does
-- NOT count toward expected cash, plus a payments table for money
-- arriving later. A customer's balance is
--   sum(their credit sales) - sum(their payments).
--
-- Payments are append-only. A cashier who could edit or delete a
-- payment row could pocket a settlement and erase the trace, which is
-- the exact hole the rest of this system was built to close.
-- ==========================================

create table if not exists customers (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    name text not null,

    phone text,

    note text,

    active boolean not null default true,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);

create index if not exists idx_customers_business
on customers(business_id);

alter table sales
    add column if not exists customer_id uuid
        references customers(id)
        on delete set null;

create index if not exists idx_sales_customer
on sales(customer_id);

-- 'credit' = taken now, paid later.
alter table sales
    drop constraint if exists sales_payment_method_check;

alter table sales
    add constraint sales_payment_method_check
        check (payment_method in ('cash', 'vodafone_cash', 'instapay', 'credit'));

-- A credit sale must say who owes the money, and a paid sale must not
-- pretend to be a tab.
alter table sales
    drop constraint if exists sales_credit_needs_customer_check;

alter table sales
    add constraint sales_credit_needs_customer_check
        check (payment_method <> 'credit' or customer_id is not null);

create table if not exists customer_payments (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    customer_id uuid not null
        references customers(id)
        on delete cascade,

    -- Which shift's drawer the money landed in, so day-close adds it
    -- to expected cash on the right day.
    shift_id uuid
        references shifts(id)
        on delete set null,

    amount numeric not null check (amount <> 0),

    method text not null default 'cash'
        check (method in ('cash', 'vodafone_cash', 'instapay')),

    note text,

    created_by uuid
        references users(id)
        on delete set null,

    created_at timestamptz not null default now()

);

create index if not exists idx_customer_payments_customer
on customer_payments(customer_id, created_at desc);

create index if not exists idx_customer_payments_shift
on customer_payments(shift_id);

-- ==========================================
-- RLS
-- ==========================================

alter table customers enable row level security;

drop policy if exists "customers_business" on customers;

create policy "customers_business" on customers
for select to authenticated
using (business_id = get_my_business_id() or is_platform_admin());

drop policy if exists "customers_staff_insert" on customers;

-- A cashier must be able to add a regular at the counter.
create policy "customers_staff_insert" on customers
for insert to authenticated
with check (business_id = get_my_business_id());

drop policy if exists "customers_staff_update" on customers;

create policy "customers_staff_update" on customers
for update to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

drop policy if exists "customers_owner_delete" on customers;

create policy "customers_owner_delete" on customers
for delete to authenticated
using (business_id = get_my_business_id() and is_business_owner());

alter table customer_payments enable row level security;

drop policy if exists "customer_payments_read" on customer_payments;

create policy "customer_payments_read" on customer_payments
for select to authenticated
using (business_id = get_my_business_id() or is_platform_admin());

-- Staff record settlements, as themselves. Only an owner may enter a
-- negative amount - that is a correction, not a payment, and it is
-- the one way to reduce a balance without money changing hands.
drop policy if exists "customer_payments_insert" on customer_payments;

create policy "customer_payments_insert" on customer_payments
for insert to authenticated
with check (
  business_id = get_my_business_id()
  and created_by = (select id from users where auth_user_id = auth.uid())
  and (amount > 0 or is_business_owner())
);

-- Deliberately no UPDATE and no DELETE policy: payments are a ledger,
-- not a scratchpad. A wrong entry is corrected by an owner adding an
-- offsetting negative row, which leaves both entries visible.

alter table businesses
    drop constraint if exists businesses_enabled_features_check;

alter table businesses
    add constraint businesses_enabled_features_check
        check (enabled_features <@ ARRAY[
            'pos_sales',
            'inventory',
            'categories',
            'shifts',
            'sales_reports',
            'multi_warehouse',
            'warehouse_reports',
            'discounts',
            'price_tiers',
            'english_receipt',
            'credit_customers'
        ]::text[]);
