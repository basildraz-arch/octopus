-- ==========================================
-- OCTOPUS ERP
-- Prevent duplicate item names within the same business
--
-- Case-insensitive: "Milk" and "milk" count as the same name.
-- This is a safety net behind the app-level check in ItemForm -
-- it only matters if two saves race at the exact same instant.
--
-- NOTE: if any business already has two items with the same name
-- (ignoring case), this statement will fail. Check first with:
--   select business_id, lower(name), count(*)
--   from items
--   group by business_id, lower(name)
--   having count(*) > 1;
-- and rename/deactivate the duplicates before running this.
-- ==========================================

create unique index if not exists idx_items_business_name_unique
on items (business_id, lower(name));
