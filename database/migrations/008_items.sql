-- ==========================================
-- OCTOPUS ERP
-- Items
--
-- Every sellable entity is an Item.
-- item_type decides whether it is a "product" or a "service".
-- There is no separate Product table or Product type.
-- ==========================================

create table if not exists items (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    category_id uuid
        references categories(id)
        on delete set null,

    name text not null,

    barcode text,

    item_type text not null
        check (item_type in ('product', 'service')),

    sale_method text not null
        check (sale_method in ('piece', 'weight', 'money')),

    unit text not null default 'piece',

    buy_price numeric(12,2) not null default 0,

    sell_price numeric(12,2) not null default 0,

    stock numeric(12,2) not null default 0,

    minimum_stock numeric(12,2) not null default 0,

    has_stock boolean not null default true,

    image text,

    keywords text[] not null default '{}',

    active boolean not null default true,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);

create index if not exists idx_items_business
on items(business_id);

create index if not exists idx_items_category
on items(category_id);

create index if not exists idx_items_name
on items(name);

create unique index if not exists idx_items_barcode
on items(barcode)
where barcode is not null;
