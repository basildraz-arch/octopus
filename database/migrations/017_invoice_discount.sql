-- ==========================================
-- OCTOPUS ERP
-- Invoice-level discount (replaces per-item min_sell_price)
--
-- Owner sets a max discount percentage once per business. NULL
-- means discounting is disabled entirely (fixed prices, current
-- behavior). At checkout, the employee enters a discount amount
-- on the whole cart total, capped by that percentage.
--
-- sales.total keeps its existing meaning: the actual final amount
-- charged (after discount). discount_amount records how much of
-- that was discounted, so "before discount" is just
-- total + discount_amount at display time - nothing that already
-- sums sales.total (shift summaries, reports, day-close cash)
-- needs to change.
--
-- The old per-item min_sell_price column on items is NOT touched
-- here - it may hold real data, so it's left in place unused
-- rather than dropped. Only the application code stops reading it.
-- ==========================================

alter table businesses
    add column max_discount_percent numeric(5,2);

alter table businesses
    add constraint businesses_max_discount_check
    check (
        max_discount_percent is null
        or (max_discount_percent >= 0 and max_discount_percent <= 100)
    );

alter table sales
    add column discount_amount numeric(12,2) not null default 0;

alter table sales
    add constraint sales_discount_amount_check
    check (discount_amount >= 0);
