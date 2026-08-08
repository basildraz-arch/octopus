-- ==========================================
-- OCTOPUS ERP
-- Self-service signup
--
-- A brand-new auth user has no row in `users` yet, so the normal
-- RLS-protected client can't insert a business/user/warehouse for
-- themselves (get_my_business_id() resolves to null until they
-- have a users row - the exact chicken-and-egg problem
-- get_my_business_id() itself was built to avoid).
--
-- complete_signup() is called once, right after the user confirms
-- their email and is authenticated for the first time. It reads the
-- full_name/business_name/app_mode that were attached to the auth
-- user at signUp() time (auth.users.raw_user_meta_data) and creates
-- the business, the owner user row, and (for warehouse_management)
-- a default warehouse - all inside one function body, so if any
-- step fails, Postgres rolls back everything else in the call too.
-- ==========================================

create or replace function complete_signup()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_auth_user_id uuid := auth.uid();
    v_metadata jsonb;
    v_full_name text;
    v_business_name text;
    v_app_mode text;
    v_business_id uuid;
begin
    if v_auth_user_id is null then
        raise exception 'يجب تسجيل الدخول أولاً';
    end if;

    if exists (select 1 from users where auth_user_id = v_auth_user_id) then
        raise exception 'الحساب مربوط ببيزنس بالفعل';
    end if;

    select raw_user_meta_data into v_metadata
    from auth.users
    where id = v_auth_user_id;

    v_full_name := v_metadata ->> 'full_name';
    v_business_name := v_metadata ->> 'business_name';
    v_app_mode := coalesce(v_metadata ->> 'app_mode', 'retail');

    if v_full_name is null or v_business_name is null then
        raise exception 'بيانات التسجيل غير مكتملة';
    end if;

    if v_app_mode not in ('retail', 'warehouse_management') then
        raise exception 'نوع نشاط غير صالح';
    end if;

    insert into businesses (name, business_type, app_mode)
    values (v_business_name, 'other', v_app_mode)
    returning id into v_business_id;

    insert into users (business_id, auth_user_id, full_name, email, role)
    values (
        v_business_id,
        v_auth_user_id,
        v_full_name,
        (select email from auth.users where id = v_auth_user_id),
        'owner'
    );

    if v_app_mode = 'warehouse_management' then
        insert into warehouses (business_id, name, is_default)
        values (v_business_id, 'المخزن الرئيسي', true);
    end if;

    return v_business_id;
end;
$$;

grant execute on function complete_signup() to authenticated;
