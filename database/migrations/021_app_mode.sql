-- ==========================================
-- OCTOPUS ERP
-- Business app mode
--
-- business_type (from migration 001) describes what the business
-- sells (pet_shop, supermarket, ...) - it's descriptive metadata,
-- unused by the UI today. app_mode is a different axis: which set
-- of screens the business actually needs. Kept as a separate
-- column on purpose, so existing business_type values (already set
-- for Medo/Sameh) don't need to change meaning.
--
-- 'retail' (default) is today's full app - every existing business
-- keeps working exactly as before. 'warehouse_management' is for
-- businesses with no POS: warehouses, items, and stock transfers
-- only. New modes can be added to the check constraint later.
-- ==========================================

alter table businesses
    add column app_mode text not null default 'retail';

alter table businesses
    add constraint businesses_app_mode_check
    check (app_mode in ('retail', 'warehouse_management'));
