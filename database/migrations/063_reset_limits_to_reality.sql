-- ==========================================
-- OCTOPUS ERP
-- Migration 063: stop charging for seats nobody is sitting in
--
-- The tier backfill in 060 handed out generous ceilings - 999 staff,
-- 10 warehouses - because inside a tier they were free. Seats cost
-- money now, so an inherited ceiling is a charge for nothing.
--
-- Every shop is reset to what it actually uses, floored at what the
-- base includes. Nobody loses anything they are standing on, and
-- nobody pays for room they never asked for.
--
-- The guard from 062 covers these columns, so the migration says who
-- it is first - the same way the Master API does.
-- ==========================================

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

update businesses b
set staff_limit = greatest(
        (select included_staff from pricing_settings),
        (select count(*) from users u
         where u.business_id = b.id and u.role <> 'owner' and u.active)
    ),
    warehouse_limit = greatest(
        (select included_warehouses from pricing_settings),
        (select count(*) from warehouses w
         where w.business_id = b.id and w.active)
    ),
    branch_limit = greatest(
        (select included_branches from pricing_settings),
        (select count(*) from branches br
         where br.business_id = b.id and br.active)
    );
