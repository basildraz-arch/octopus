-- ==========================================
-- OCTOPUS ERP
-- Feature flags - replaces the fixed retail/warehouse_management
-- app_mode with a flexible per-business feature set.
--
-- app_mode is NOT dropped here on purpose - it stays in place as a
-- safety net while the application code migrates from reading
-- app_mode to reading enabled_features. It gets removed in a later,
-- separate cleanup migration once everything is confirmed working.
--
-- enabled_features is backfilled from each business's CURRENT
-- app_mode value (data-driven, not hardcoded by business name), so
-- every existing business - including any test account whose mode
-- was toggled back and forth - ends up with exactly the access it
-- already has today. Zero visible impact.
-- ==========================================

alter table businesses
    add column if not exists enabled_features text[] not null default '{}';

alter table businesses
    add constraint businesses_enabled_features_check
    check (enabled_features <@ array[
        'pos_sales',
        'inventory',
        'categories',
        'shifts',
        'sales_reports',
        'multi_warehouse',
        'warehouse_reports',
        'discounts'
    ]::text[]);

update businesses
set enabled_features = case
    when app_mode = 'warehouse_management'
        then array['inventory', 'multi_warehouse', 'warehouse_reports']
    else
        array['pos_sales', 'inventory', 'categories', 'shifts', 'sales_reports', 'discounts']
end
where enabled_features = '{}';
