-- ==========================================
-- OCTOPUS ERP
-- Receipt paper size (Kero items 5 and 6 groundwork)
--
-- A receipt laid out for A4 is unreadable on a 58mm till roll and
-- vice versa: the paper width decides font size, how many columns
-- fit, and whether a logo is worth printing at all. Most small shops
-- use an 80mm thermal roll, so that is the default, but this must be
-- a setting rather than an assumption - we do not always know what
-- the shop owns.
--
-- The logo itself reuses the existing businesses.logo column.
-- ==========================================

alter table businesses
    add column if not exists receipt_paper text
        not null
        default 'thermal_80';

alter table businesses
    drop constraint if exists businesses_receipt_paper_check;

alter table businesses
    add constraint businesses_receipt_paper_check
        check (receipt_paper in ('thermal_58', 'thermal_80', 'a4'));
