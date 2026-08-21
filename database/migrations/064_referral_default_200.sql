-- ==========================================
-- OCTOPUS ERP
-- Migration 064: the referral reward settles at 200 for twelve months
--
-- 2,400 per referred shop, and - the part that matters - an
-- obligation with an end date. A reward that never stops pays
-- forever for work that happened once, and on a subscription this
-- size it quietly signs away a fifth of the revenue from every
-- referred customer for as long as they stay.
--
-- Still a per-code field, so a different deal for one marketer stays
-- one number on one row.
-- ==========================================

alter table referral_codes alter column monthly_reward set default 200;
