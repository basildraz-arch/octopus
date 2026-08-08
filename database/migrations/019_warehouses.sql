-- ==========================================
-- OCTOPUS ERP
-- Multiple warehouses per business - Phase 1 (schema only)
--
-- Adds a warehouses table and ties stock_batches to a warehouse.
-- No separate "warehouse_stock" balance table - stock_batches
-- (from migration 014) is already the real source of truth for
-- quantity, so a warehouse's balance for an item is just
-- sum(remaining_quantity) where item_id = X and warehouse_id = Y.
--
-- Every existing business gets one "المخزن الرئيسي" warehouse,
-- and every existing batch is backfilled onto it - so nothing
-- about current stock numbers changes. items.stock keeps its
-- current meaning (a cached total across all warehouses) and
-- keeps being written by the app exactly as it is today.
--
-- Purchases/sales still implicitly use the default warehouse for
-- now - a later phase adds the UI to pick a warehouse and to
-- transfer stock between warehouses.
-- ==========================================

create table if not exists warehouses (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    name text not null,

    is_default boolean not null default false,

    active boolean not null default true,

    created_at timestamptz not null default now()

);

create index if not exists idx_warehouses_business
on warehouses(business_id);

-- only one default warehouse per business
create unique index if not exists idx_warehouses_one_default
on warehouses(business_id) where is_default = true;

alter table warehouses enable row level security;

drop policy if exists "business_isolation" on warehouses;

create policy "business_isolation" on warehouses
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

-- ==========================================
-- One default warehouse per existing business.
-- Safe to re-run - skips businesses that already have one.
-- ==========================================

insert into warehouses (business_id, name, is_default)
select id, 'المخزن الرئيسي', true
from businesses
where not exists (
    select 1 from warehouses
    where warehouses.business_id = businesses.id
    and warehouses.is_default = true
);

-- ==========================================
-- Tie stock_batches to a warehouse
-- ==========================================

alter table stock_batches
    add column if not exists warehouse_id uuid references warehouses(id);

update stock_batches sb
set warehouse_id = w.id
from warehouses w
where w.business_id = sb.business_id
and w.is_default = true
and sb.warehouse_id is null;

-- abort the whole migration (everything above rolls back too) if
-- any batch was left without a warehouse - something unexpected
-- happened and forcing the column to not null blind is not safe
do $$
begin
    if exists (select 1 from stock_batches where warehouse_id is null) then
        raise exception 'stock_batches has rows with no warehouse_id - aborting migration';
    end if;
end $$;

alter table stock_batches
    alter column warehouse_id set not null;

create index if not exists idx_stock_batches_item_warehouse
on stock_batches(item_id, warehouse_id);
