-- ==========================================
-- OCTOPUS ERP
-- Multiple warehouses - Phase 2: stock transfers
--
-- This table is an audit trail only - who moved what, from where,
-- to where, and when. The actual quantity movement happens through
-- stock_batches (draw from the source warehouse, create a new batch
-- in the destination warehouse), the same mechanism purchases and
-- sales already use. A transfer never touches items.stock, since
-- the total across all warehouses is unchanged by moving stock
-- between them.
-- ==========================================

create table if not exists stock_transfers (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    item_id uuid not null
        references items(id)
        on delete cascade,

    from_warehouse_id uuid not null
        references warehouses(id),

    to_warehouse_id uuid not null
        references warehouses(id),

    quantity numeric(12,2) not null,

    created_by uuid
        references users(id),

    created_at timestamptz not null default now()

);

create index if not exists idx_stock_transfers_business
on stock_transfers(business_id);

create index if not exists idx_stock_transfers_item
on stock_transfers(item_id, created_at);

alter table stock_transfers enable row level security;

drop policy if exists "business_isolation" on stock_transfers;

create policy "business_isolation" on stock_transfers
for all to authenticated
using (business_id = get_my_business_id())
with check (business_id = get_my_business_id());
