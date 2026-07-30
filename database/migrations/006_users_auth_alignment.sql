-- ==========================================
-- OCTOPUS ERP
-- Users / Supabase Auth Alignment
-- ==========================================

alter table users
    add column auth_user_id uuid unique references auth.users(id) on delete cascade;

alter table users
    drop column password_hash;

alter table users
    add constraint users_role_check check (role in ('owner', 'employee'));
