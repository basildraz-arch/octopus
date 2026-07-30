-- ==========================================
-- OCTOPUS ERP
-- Shifts (Day Close)
--
-- A shift represents one "open day" of sales. A sale always
-- belongs to the shift that was open when it happened.
-- closed_at is null while the shift is open; it is the only
-- source of truth for open/closed state. Totals and payment
-- method breakdowns are never stored here - they are always
-- computed live from `sales`, so reopening a shift never leaves
-- stale numbers behind.
-- ==========================================

create table if not exists shifts (

    id uuid primary key default gen_random_uuid(),

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    opened_at timestamptz not null default now(),

    closed_at timestamptz,

    closed_by uuid
        references users(id)
        on delete set null,

    counted_cash numeric(12,2),

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);

create index if not exists idx_shifts_business
on shifts(business_id);

create index if not exists idx_shifts_open
on shifts(business_id)
where closed_at is null;

-- ==========================================
-- Sales: link to shift + payment method
-- ==========================================

alter table sales
    add column shift_id uuid
        references shifts(id)
        on delete set null;

alter table sales
    add column payment_method text not null default 'cash'
        check (payment_method in ('cash', 'vodafone_cash', 'instapay'));

create index if not exists idx_sales_shift
on sales(shift_id);
