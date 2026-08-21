-- ==========================================
-- OCTOPUS ERP
-- Migration 054: the app tells the owner when an invoice was opened
-- and never rung up
--
-- This is the anti-theft feature finally speaking on its own. The
-- cart audit log (migration 035) has recorded abandoned sessions
-- since the day it shipped, but only ever answered when asked - the
-- owner had to open a screen and read it. A shop owner who is busy,
-- or away, or asleep at 3am while the shop runs 24 hours, never asked.
--
-- WHEN IT FIRES
-- The moment a cashier starts a NEW cart, the one they were on before
-- is judged: did it have items added, and did it end in a sale or a
-- printed quote? Items in, nothing out, means the invoice was built
-- and dropped. That is the exact pattern the whole feature was asked
-- for - "يبين لو حد فتح فاتورة وحذفها قبل ما ينفذها".
--
-- Event-driven rather than time-driven on purpose: no scheduled job
-- to keep alive, no "abandoned after N minutes" guess to tune, and
-- the notification arrives while the customer who walked away is
-- probably still in sight.
--
-- Marked 'danger', so it stands out from a low-stock notice - this is
-- the one an owner is meant to look at now.
-- ==========================================

create or replace function notify_abandoned_cart()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_prev uuid;
    v_adds int;
    v_finished int;
    v_total numeric;
    v_name text;
begin
    if new.action <> 'add' then
        return new;
    end if;

    -- Only on the first event of a session: a cart with ten items
    -- should not judge its predecessor ten times.
    if exists (
        select 1 from cart_audit_log
        where cart_session_id = new.cart_session_id and id <> new.id
    ) then
        return new;
    end if;

    select cart_session_id into v_prev
    from cart_audit_log
    where business_id = new.business_id
      and user_id = new.user_id
      and cart_session_id <> new.cart_session_id
    order by created_at desc
    limit 1;

    if v_prev is null then
        return new;
    end if;

    select count(*) filter (where action = 'add'),
           count(*) filter (where action in ('checkout', 'quote')),
           coalesce(sum(line_total) filter (where action = 'add'), 0)
    into v_adds, v_finished, v_total
    from cart_audit_log
    where cart_session_id = v_prev;

    if v_adds > 0 and v_finished = 0 then
        select full_name into v_name from users where id = new.user_id;

        perform notify(
            new.business_id,
            'owner',
            'abandoned_cart',
            'فاتورة اتفتحت وماتنفذتش',
            coalesce(v_name, 'الكاشير') || ' حط أصناف بـ '
              || trim(to_char(v_total, 'FM999999990.00'))
              || ' ج وقفل الفاتورة من غير بيع',
            '/sales-audit',
            'danger'
        );
    end if;

    return new;
end;
$$;

drop trigger if exists trg_notify_abandoned_cart on cart_audit_log;

create trigger trg_notify_abandoned_cart
after insert on cart_audit_log
for each row execute function notify_abandoned_cart();
