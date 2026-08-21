-- ==========================================
-- OCTOPUS ERP
-- Migration 061: the limits actually refuse
--
-- A limit that only hides a button is not a limit, it is a
-- suggestion. These three triggers are what make a plan mean
-- something - and what turns "I need another branch" from a support
-- conversation into an upgrade.
--
-- WHAT CHANGED FOR WAREHOUSES AND BRANCHES
-- Migration 049 refused the SECOND one, full stop, for everybody.
-- That was right when every shop was the same size and wrong the
-- moment plans existed: a shop paying for ten warehouses should add
-- its own without asking. The guard now compares against the
-- business's limit, so inside the plan it passes and outside it the
-- owner is told, in Arabic, what their plan holds.
--
-- Approving a request is what grants the capacity: the change-request
-- route raises the limit before inserting, because otherwise the
-- approval would be refused by this very trigger.
--
-- STAFF IS NEW
-- There was no employee ceiling at all before. This one fires for the
-- service role too, on purpose - the employee approval route runs as
-- service role, and a limit the platform admin can walk past without
-- noticing is not a limit either. The way past it is to raise the
-- plan or the shop's own staff_limit, which is a decision with a
-- price attached rather than an accident.
--
-- Verified on live data: a third warehouse on a two-warehouse plan is
-- refused with the plan's number in the message, an over-limit
-- employee insert is refused, and an under-limit one passes.
-- ==========================================

create or replace function guard_extra_warehouse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
    v_limit int;
begin
    select warehouse_limit into v_limit from businesses where id = new.business_id;

    select count(*) into v_count
    from warehouses
    where business_id = new.business_id and active;

    if v_count >= coalesce(v_limit, 1) then
        raise exception 'باقتك فيها % مخزن. زيادة مخزن بتتم بطلب موافقة من الإدارة', coalesce(v_limit, 1);
    end if;

    return new;
end;
$$;

create or replace function guard_extra_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
    v_limit int;
begin
    select branch_limit into v_limit from businesses where id = new.business_id;

    select count(*) into v_count
    from branches
    where business_id = new.business_id and active;

    if v_count >= coalesce(v_limit, 1) then
        raise exception 'باقتك فيها % فرع. زيادة فرع بتتم بطلب موافقة من الإدارة', coalesce(v_limit, 1);
    end if;

    return new;
end;
$$;

create or replace function guard_staff_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
    v_limit int;
begin
    -- The owner is not a staff seat; a business always has exactly
    -- one and it is not something they chose to buy.
    if new.role = 'owner' then
        return new;
    end if;

    select staff_limit into v_limit from businesses where id = new.business_id;

    select count(*) into v_count
    from users
    where business_id = new.business_id
      and role <> 'owner'
      and active;

    if v_count >= coalesce(v_limit, 2) then
        raise exception 'الباقة دي فيها % موظفين، وكلهم مستخدمين. لازم ترقية قبل إضافة موظف جديد', coalesce(v_limit, 2);
    end if;

    return new;
end;
$$;

drop trigger if exists trg_guard_staff_limit on users;

create trigger trg_guard_staff_limit
before insert on users
for each row execute function guard_staff_limit();

revoke execute on function guard_staff_limit() from public, anon, authenticated;
