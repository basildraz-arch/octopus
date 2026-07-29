-- ==========================================
-- USERS
-- ==========================================

create table if not exists users (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    branch_id uuid
        references branches(id)
        on delete set null,

    full_name text not null,

    email text unique,

    phone text unique,

    password_hash text not null,

    role text not null,

    active boolean not null default true,

    avatar text,

    last_login timestamptz,

    created_at timestamptz default now(),

    updated_at timestamptz default now()

);

create index if not exists idx_users_business
on users(business_id);

create index if not exists idx_users_branch
on users(branch_id);

create index if not exists idx_users_role
on users(role);