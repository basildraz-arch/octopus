-- ==========================================
-- OCTOPUS ERP
-- Cashier PIN login
--
-- A cashier signs in dozens of times a shift, standing at a till, in
-- front of a customer. A generated password is the wrong instrument:
-- it gets written on a sticky note next to the screen, which is worse
-- than a PIN in every way.
--
-- So: the owner sets a 4-6 digit PIN per cashier, and the cashier taps
-- it on a numeric keypad.
--
-- WHY A SEPARATE TABLE, NOT A COLUMN ON `users`:
-- every member of a business can SELECT the whole `users` row
-- (migration 034) - they need to, for "sold by" labels and staff
-- lists. A pin_hash column there would be readable by every cashier
-- in the shop. This table has RLS enabled and NO policies at all, for
-- any role: PostgREST therefore denies every client request against
-- it, and only the service role (server-side API routes) can read or
-- write it. The hash never leaves the server.
--
-- A 4-digit PIN is only 10,000 combinations, so the lockout columns
-- below are not optional decoration - they are what makes this safe
-- enough to expose on the public internet.
-- ==========================================

create table if not exists employee_pins (

    user_id uuid primary key
        references users(id)
        on delete cascade,

    business_id uuid not null
        references businesses(id)
        on delete cascade,

    -- scrypt$<salt_hex>$<derived_key_hex> - never a plaintext PIN
    pin_hash text not null,

    failed_attempts integer not null default 0,

    locked_until timestamptz,

    set_by uuid
        references users(id)
        on delete set null,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()

);

create index if not exists idx_employee_pins_business
on employee_pins(business_id);

alter table employee_pins enable row level security;

-- Intentionally no policies. RLS with zero policies = deny all for
-- anon and authenticated. The service role bypasses RLS and is the
-- only way in, which is exactly the intent.
