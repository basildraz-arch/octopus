-- ==========================================
-- OCTOPUS ERP
-- Migration 050: the signup wizard has to read templates before
-- anyone is signed in
--
-- Migration 046 granted SELECT to `authenticated` only. But the shop
-- owner picks their business type on step 2 of signup, which happens
-- before the auth account exists - so the list came back empty and
-- the wizard had nothing to show.
--
-- What is being exposed: the names of the business types Octopus
-- supports and which features each one starts with. That is the same
-- information any product page would print. Inactive templates stay
-- hidden (`using (active)`), and writes are still platform-admin only.
-- ==========================================

drop policy if exists business_templates_read on business_templates;

create policy business_templates_read on business_templates
for select to anon, authenticated
using (active);

grant select on business_templates to anon;
