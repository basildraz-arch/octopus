-- ==========================================
-- OCTOPUS ERP
-- Business templates at signup
--
-- complete_signup() no longer derives enabled_features from a
-- retail/warehouse_management app_mode choice - the client now sends
-- the final feature list directly (a template's defaults, possibly
-- edited by the user before submitting), since templates are no
-- longer just two mutually-exclusive presets.
--
-- app_mode (the legacy safety-net column from migration 026) is now
-- just a best-effort label derived FROM the chosen features, purely
-- for backward compatibility - nothing in the app reads it anymore.
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
    v_enabled_features text[];
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

    if v_full_name is null or v_business_name is null then
        raise exception 'بيانات التسجيل غير مكتملة';
    end if;

    if v_metadata ? 'enabled_features' then
        select array(
            select jsonb_array_elements_text(v_metadata -> 'enabled_features')
        )
        into v_enabled_features;
    end if;

    if v_enabled_features is null or array_length(v_enabled_features, 1) is null then
        raise exception 'لم يتم تحديد أي ميزات لهذا الحساب';
    end if;

    if not (v_enabled_features <@ array[
        'pos_sales',
        'inventory',
        'categories',
        'shifts',
        'sales_reports',
        'multi_warehouse',
        'warehouse_reports',
        'discounts'
    ]::text[]) then
        raise exception 'قيمة ميزة غير صالحة';
    end if;

    v_app_mode := case
        when 'multi_warehouse' = any(v_enabled_features) then 'warehouse_management'
        else 'retail'
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
