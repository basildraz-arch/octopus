-- ==========================================
-- OCTOPUS ERP
-- Fix: complete_signup() must create a default warehouse for every
-- new business, not just warehouse_management ones.
--
-- Purchases, sales, and opening-stock all resolve the business's
-- default warehouse (getDefaultWarehouse) to record stock_batches -
-- retail businesses rely on this in the background exactly like
-- warehouse_management ones do. A retail signup with no warehouse
-- would fail on its very first purchase/sale/item-with-stock.
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

    -- كل بيزنس جديد ياخد مخزن افتراضي، بغض النظر عن app_mode -
    -- retail بيستخدمه في الخلفية لتتبع المخزون (stock_batches)
    -- بنفس طريقة warehouse_management بالظبط
    insert into warehouses (business_id, name, is_default)
    values (v_business_id, 'المخزن الرئيسي', true);

    return v_business_id;
end;
$$;

grant execute on function complete_signup() to authenticated;
