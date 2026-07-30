-- ==========================================
-- OCTOPUS ERP
-- Categories
-- ==========================================

create table if not exists categories (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    name text not null,

    color text,

    icon text,

    sort_order integer not null default 0,

    active boolean not null default true,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);

create index if not exists idx_categories_business
on categories(business_id);

create index if not exists idx_categories_name
on categories(name);
