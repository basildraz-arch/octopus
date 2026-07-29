-- ==========================================
-- OCTOPUS ERP
-- Initial Schema
-- ==========================================

create extension if not exists "pgcrypto";

-- ==========================
-- Businesses
-- ==========================

create table if not exists businesses (

    id uuid primary key default gen_random_uuid(),

    name text not null,

    business_type text not null,

    custom_business_type text,

    phone text,

    email text,

    address text,

    logo text,

    currency text not null default 'EGP',

    language text not null default 'ar',

    timezone text not null default 'Africa/Cairo',

    active boolean not null default true,

    trial_end timestamptz,

    created_at timestamptz default now(),

    updated_at timestamptz default now()

);