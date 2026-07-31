-- ==========================================
-- OCTOPUS ERP
-- Stock Batches (FIFO costing)
--
-- Replaces weighted-average buy_price updates on purchase with
-- proper FIFO batch tracking: every purchase creates a new batch,
-- every sale draws from the oldest batch(es) with remaining stock
-- first. items.stock/buy_price stay in sync as computed values -
-- the batches are the real source of truth now.
-- ==========================================

create table if not exists stock_batches (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    item_id uuid not null
        references items(id)
        on delete cascade,

    purchase_id uuid
        references purchases(id)
        on delete set null,

    quantity numeric(12,2) not null,

    remaining_quantity numeric(12,2) not null,

    buy_price numeric(12,2) not null,

    created_at timestamptz not null default now()

);

create index if not exists idx_stock_batches_item
on stock_batches(item_id, created_at);

alter table stock_batches enable row level security;

drop policy if exists "business_isolation" on stock_batches;

create policy "business_isolation" on stock_batches
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());

-- ==========================================
-- Opening batches: give existing stock a batch to track,
-- so FIFO has something to draw from immediately. Safe to
-- re-run - only backfills items that have no batch yet.
-- ==========================================

insert into stock_batches (business_id, item_id, purchase_id, quantity, remaining_quantity, buy_price, created_at)
select business_id, id, null, stock, stock, buy_price, now()
from items
where stock > 0
and not exists (
    select 1 from stock_batches where stock_batches.item_id = items.id
);

-- ==========================================
-- sale_items: record the actual FIFO cost of each sold line
-- ==========================================

alter table sale_items
    add column cost numeric(12,2);
