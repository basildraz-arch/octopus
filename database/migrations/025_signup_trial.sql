-- ==========================================
-- OCTOPUS ERP
-- complete_signup() sets trial_ends_at explicitly for every new
-- self-service signup, instead of relying implicitly on the
-- businesses.trial_ends_at column default added in migration 024.
-- The column default stays in place as a fallback for any business
-- created outside this function (e.g. manually in Supabase).
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

    insert into businesses (name, business_type, app_mode, trial_ends_at)
    values (v_business_name, 'other', v_app_mode, now() + interval '7 days')
    returning id into v_business_id;

    insert into users (business_id, auth_user_id, full_name, email, role)
    values (
        v_business_id,
        v_auth_user_id,
        v_full_name,
        (select email from auth.users where id = v_auth_user_id),
        'owner'
    );

    insert into warehouses (business_id, name, is_default)
    values (v_business_id, 'المخزن الرئيسي', true);

    return v_business_id;
end;
$$;

grant execute on function complete_signup() to authenticated;
