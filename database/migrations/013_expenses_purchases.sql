-- ==========================================
-- OCTOPUS ERP
-- Expenses + Purchases
--
-- Expenses: recorded by the Employee, always tied to the shift
-- that was open at the time (same auto-open pattern as sales).
-- Purchases: recorded by the Owner, restocks an item's inventory.
-- Not tied to a shift - buying stock isn't a cashier operation.
--
-- Both tables get RLS from the start, same business_id isolation
-- pattern as 012_rls_policies.sql.
-- ==========================================

create table if not exists expenses (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    shift_id uuid not null
        references shifts(id)
        on delete cascade,

    created_by uuid
        references users(id)
        on delete set null,

    amount numeric(12,2) not null,

    description text not null,

    created_at timestamptz not null default now()

);

create index if not exists idx_expenses_business
on expenses(business_id);

create index if not exists idx_expenses_shift
on expenses(shift_id);

create table if not exists purchases (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    item_id uuid not null
        references items(id)
        on delete restrict,

    created_by uuid
        references users(id)
        on delete set null,

    quantity numeric(12,2) not null,

    buy_price numeric(12,2) not null,

    total numeric(12,2) not null,

    created_at timestamptz not null default now()

);

create index if not exists idx_purchases_business
on purchases(business_id);

create index if not exists idx_purchases_item
on purchases(item_id);

-- ==========================================
-- RLS
-- ==========================================

alter table expenses enable row level security;

drop policy if exists "business_isolation" on expenses;

create policy "business_isolation" on expenses
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

alter table purchases enable row level security;

drop policy if exists "business_isolation" on purchases;

create policy "business_isolation" on purchases
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());
