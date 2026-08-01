-- ==========================================
-- OCTOPUS ERP
-- Flexible selling price (min_sell_price)
--
-- Optional lower bound on what an item can be sold for. NULL means
-- the price stays fixed exactly as before. When set, the cashier
-- can adjust the price at sale time anywhere between min_sell_price
-- and sell_price - useful for haggling on products or variable
-- service pricing (e.g. a haircut).
-- ==========================================

alter table items
    add column min_sell_price numeric(12,2);

alter table items
    add constraint items_min_sell_price_check
    check (min_sell_price is null or min_sell_price <= sell_price);
