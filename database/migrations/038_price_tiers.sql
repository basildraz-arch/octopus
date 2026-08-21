-- ==========================================
-- OCTOPUS ERP
-- Three price tiers per item (Kero item 4)
--
-- Kero's own price list already works this way: every drink carries
-- three prices (قطاعي / نص جملة / جملة in his spreadsheet, which he
-- describes to customers as سياح / مصريين / أهل البلد). So this is not
-- a discount on one price - it is three real prices per item, and the
-- cashier picks which one applies to the customer in front of them.
--
-- Modelled as columns rather than a prices table on purpose: the
-- count is fixed at three, every read of an item needs all three, and
-- a join per item on the POS hot path would buy nothing.
--
-- tier 1 = sell_price, the existing column. Untouched, so every
-- existing business keeps working with exactly one price and no
-- migration of their data.
-- ==========================================

alter table items
    add column if not exists sell_price_2 numeric,
    add column if not exists sell_price_3 numeric;

-- Labels live on the business because they are the shop's own words.
-- Defaults are what Kero calls them; any owner can rename them.
alter table businesses
    add column if not exists price_tier_labels text[]
        not null
        default array['سياح', 'مصريين', 'أهل البلد'];

alter table businesses
    drop constraint if exists businesses_price_tier_labels_check;

alter table businesses
    add constraint businesses_price_tier_labels_check
        check (array_length(price_tier_labels, 1) = 3);

-- Which tier a completed sale was rung up at. Needed for two things:
-- per-tier reporting, and knowing whether to print the English
-- receipt (the top tier is the tourist price).
alter table sales
    add column if not exists price_tier smallint not null default 1;

alter table sales
    drop constraint if exists sales_price_tier_check;

alter table sales
    add constraint sales_price_tier_check
        check (price_tier between 1 and 3);

-- Opt-in per business, like every other feature in this app: a shop
-- with a single price should never see a tier selector at the till.
alter table businesses
    drop constraint if exists businesses_enabled_features_check;

alter table businesses
    add constraint businesses_enabled_features_check
        check (enabled_features <@ ARRAY[
            'pos_sales',
            'inventory',
            'categories',
            'shifts',
            'sales_reports',
            'multi_warehouse',
            'warehouse_reports',
            'discounts',
            'price_tiers',
            'english_receipt'
        ]::text[]);
