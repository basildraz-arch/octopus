-- ==========================================
-- ROLE PERMISSIONS
-- ==========================================

create table if not exists role_permissions (

    id uuid primary key default gen_random_uuid(),

    role_id uuid not null
        references roles(id)
        on delete cascade,

    permission_key text not null,

    allowed boolean not null default false,

    created_at timestamptz default now()

);

create unique index if not exists idx_role_permission_unique
on role_permissions(role_id, permission_key);

create index if not exists idx_role_permissions_role
on role_permissions(role_id);