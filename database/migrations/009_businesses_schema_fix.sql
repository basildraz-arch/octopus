-- ==========================================
-- OCTOPUS ERP
-- Businesses Schema Fix
--
-- Removes columns that were added directly on the live database
-- outside of any migration file (owner_name, subscription_plan,
-- subscription_status), so the schema matches the canonical
-- design in docs/FULL_CONSOLIDATION_AUDIT.md.
-- ==========================================

alter table businesses
    drop column owner_name;

alter table businesses
    drop column subscription_plan;

alter table businesses
    drop column subscription_status;
