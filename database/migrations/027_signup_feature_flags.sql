-- ==========================================
-- OCTOPUS ERP
-- complete_signup() now also sets enabled_features for every new
-- self-service signup, using the same retail/warehouse_management
-- mapping used to backfill existing businesses in migration 026.
-- app_mode is still set too (kept as a safety net for now, per 026).
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
    v_enabled_features text[];
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

    v_enabled_features := case
        when v_app_mode = 'warehouse_management'
            then array['inventory', 'multi_warehouse', 'warehouse_reports']
        else
            array['pos_sales', 'inventory', 'categories', 'shifts', 'sales_reports', 'discounts']
    end;

    insert into businesses (name, business_type, app_mode, trial_ends_at, enabled_features)
    values (
        v_business_name,
        'other',
        v_app_mode,
        now() + interval '7 days',
        v_enabled_features
    )
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
