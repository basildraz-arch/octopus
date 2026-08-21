-- ==========================================
-- OCTOPUS ERP
-- Separate printing from selling (Kero item 5)
--
-- The rule Kero asked for: every SALE must print, always - the
-- printed receipt is what makes the money visible to the customer
-- and therefore hard to pocket. Printing on its own (a price quote, a
-- customer asking "how much would this come to") stays optional.
--
-- Both halves matter for the anti-theft story, so the non-sale print
-- is recorded too: a cashier producing a stream of slips that never
-- become sales is exactly the pattern the audit log exists to expose.
-- ==========================================

alter table businesses
    add column if not exists force_print_on_sale boolean
        not null
        default true;

-- 'quote' joins add/remove/checkout: a print that was NOT a sale.
alter table cart_audit_log
    drop constraint if exists cart_audit_log_action_check;

alter table cart_audit_log
    add constraint cart_audit_log_action_check
        check (action in ('add', 'remove', 'checkout', 'quote'));
