-- ==========================================
-- OCTOPUS ERP
-- Fix: restore complete_signup() to its migration-028 behaviour
--
-- REGRESSION BEING FIXED (introduced by migration 034):
-- 034 needed to add one guard to complete_signup (an employee login
-- must not be able to create its own business). It rebuilt the
-- function from the body in migration 022 - not realising 023/025/027
-- /028 had each replaced that body since. The result silently undid:
--
--   1. enabled_features. 028 reads the feature list the signup wizard
--      sends; 022 read a legacy app_mode string instead. Under 034 a
--      brand-new business was created with enabled_features = '{}' -
--      an account that signs up successfully and then finds every
--      screen missing.
--   2. The default warehouse. 023 creates 'المخزن الرئيسي' for EVERY
--      business; 022 only did it for warehouse_management. Without it
--      getDefaultWarehouse() throws, so a retail shop could not save
--      an item that has stock.
--   3. trial_ends_at set explicitly at insert time.
--
-- This restores 028's body verbatim, then re-applies 034's guard on
-- top - the change 034 was actually trying to make.
--
-- Also widens the allowed feature list to include the two flags added
-- in 038 (price_tiers, english_receipt) so they can be switched on at
-- signup rather than only afterwards.
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
    v_email text;
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

    select email, raw_user_meta_data into v_email, v_metadata
    from auth.users
    where id = v_auth_user_id;

    -- The guard migration 034 set out to add: a cashier login issued
    -- by a shop cannot turn itself into an independent business.
    if v_email like '%@octopus.local' or v_email like '%.octopus.local' then
        raise exception 'حساب موظف مينفعش يسجّل بيزنس لوحده';
    end if;

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
        'discounts',
        'price_tiers',
        'english_receipt'
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
        v_email,
        'owner'
    );

    -- Every business gets one, retail included (migration 023).
    insert into warehouses (business_id, name, is_default)
    values (v_business_id, 'المخزن الرئيسي', true);

    return v_business_id;
end;
$$;

grant execute on function complete_signup() to authenticated;
