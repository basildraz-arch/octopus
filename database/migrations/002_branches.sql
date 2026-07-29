-- ==========================================
-- BRANCHES
-- ==========================================

create table if not exists branches (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    name text not null,

    code text not null,

    phone text,

    email text,

    address text,

    manager_id uuid,

    active boolean not null default true,

    created_at timestamptz default now(),

    updated_at timestamptz default now()

);

create index if not exists idx_branches_business
on branches(business_id);