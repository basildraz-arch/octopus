-- ==========================================
-- OCTOPUS ERP
-- Sales
-- ==========================================

create table if not exists sales (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    created_by uuid
        references users(id)
        on delete set null,

    total numeric(12,2) not null default 0,

    created_at timestamptz not null default now()

);

create index if not exists idx_sales_business
on sales(business_id);

create index if not exists idx_sales_created_at
on sales(created_at);

create table if not exists sale_items (

    id uuid primary key default gen_random_uuid(),

    sale_id uuid not null
        references sales(id)
        on delete cascade,

    item_id uuid not null
        references items(id)
        on delete restrict,

    quantity numeric(12,2) not null,

    unit_price numeric(12,2) not null,

    total numeric(12,2) not null,

    created_at timestamptz not null default now()

);

create index if not exists idx_sale_items_sale
on sale_items(sale_id);

create index if not exists idx_sale_items_item
on sale_items(item_id);
