-- ==========================================
-- ROLES
-- ==========================================

create table if not exists roles (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    name text not null,

    description text,

    is_system boolean not null default false,

    created_at timestamptz default now(),

    updated_at timestamptz default now()

);

create index if not exists idx_roles_business
on roles(business_id);