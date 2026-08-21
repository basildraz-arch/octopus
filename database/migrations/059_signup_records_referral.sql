-- ==========================================
-- OCTOPUS ERP
-- Migration 059: signup records who sent them
--
-- The invite code and the referral code are the same code. One field
-- at the start of signup both opens the door and records attribution,
-- so there is no second step for anyone to forget and no separate
-- "enter your referrer" screen to ignore.
--
-- Everything above the referral block is byte-for-byte migration 057.
-- Spelled out in full rather than patched, because this function has
-- been broken by a careless rewrite before (see the note on migration
-- 034) and it is the one path every customer walks exactly once.
--
-- The referral is recorded, not qualified: qualified_at stays null
-- until the shop actually pays. See migration 058.
-- ==========================================

create or replace function complete_signup()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_auth_user_id uuid := auth.uid();
    v_metadata jsonb;
    v_email text;
    v_full_name text;
    v_business_name text;
    v_business_type text;
    v_enabled_features text[];
    v_app_mode text;
    v_business_id uuid;
    v_template business_templates%rowtype;
    v_category text;
    v_referral_code text;
    v_referral_code_id uuid;
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

    if v_email like '%@octopus.local' or v_email like '%.octopus.local' then
        raise exception 'حساب موظف مينفعش يسجّل بيزنس لوحده';
    end if;

    v_full_name := v_metadata ->> 'full_name';
    v_business_name := v_metadata ->> 'business_name';

    if v_full_name is null or v_business_name is null then
        raise exception 'بيانات التسجيل غير مكتملة';
    end if;

    v_business_type := coalesce(v_metadata ->> 'business_type', 'other');

    select * into v_template
    from business_templates
    where business_type = v_business_type and active;

    if not found then
        v_business_type := 'other';
        select * into v_template from business_templates where business_type = 'other';
    end if;

    if v_metadata ? 'enabled_features' then
        select array(
            select jsonb_array_elements_text(v_metadata -> 'enabled_features')
        )
        into v_enabled_features;
    end if;

    if v_enabled_features is null or array_length(v_enabled_features, 1) is null then
        v_enabled_features := v_template.enabled_features;
    end if;

    if v_enabled_features is null or array_length(v_enabled_features, 1) is null then
        raise exception 'لم يتم تحديد أي ميزات لهذا الحساب';
    end if;

    if not (v_enabled_features <@ array[
        'pos_sales','inventory','categories','shifts','sales_reports',
        'multi_warehouse','warehouse_reports','discounts','price_tiers',
        'english_receipt','credit_customers'
    ]::text[]) then
        raise exception 'قيمة ميزة غير صالحة';
    end if;

    v_app_mode := case
        when 'multi_warehouse' = any(v_enabled_features) then 'warehouse_management'
        else coalesce(v_template.app_mode, 'retail')
    end;

    insert into businesses (
        name, business_type, app_mode, trial_ends_at, enabled_features,
        price_tier_labels, receipt_paper, force_print_on_sale, ui_labels
    )
    values (
        v_business_name, v_business_type, v_app_mode,
        now() + interval '7 days', v_enabled_features,
        coalesce(v_template.price_tier_labels, array['سعر 1','سعر 2','سعر 3']),
        coalesce(v_template.receipt_paper, 'thermal_80'),
        coalesce(v_template.force_print_on_sale, true),
        coalesce(v_template.ui_labels, '{}'::jsonb)
    )
    returning id into v_business_id;

    insert into users (business_id, auth_user_id, full_name, email, role)
    values (v_business_id, v_auth_user_id, v_full_name, v_email, 'owner');

    insert into warehouses (business_id, name, is_default)
    values (v_business_id, 'المخزن الرئيسي', true);

    if v_template.default_categories is not null then
        foreach v_category in array v_template.default_categories loop
            insert into categories (business_id, name) values (v_business_id, v_category);
        end loop;
    end if;

    -- Who sent them. Recorded here and never again: the referrer is
    -- fixed at signup so it cannot be reassigned later.
    --
    -- A bad or retired code is skipped in silence. Refusing a signup
    -- because of a referral would trade a paying customer for an
    -- attribution, which is never the right way round.
    v_referral_code := upper(trim(coalesce(v_metadata ->> 'referral_code', '')));

    if v_referral_code <> '' then
        select id into v_referral_code_id
        from referral_codes
        where code = v_referral_code
          and active
          and (business_id is null or business_id <> v_business_id);

        if v_referral_code_id is not null then
            insert into referrals (referral_code_id, referred_business_id)
            values (v_referral_code_id, v_business_id)
            on conflict (referred_business_id) do nothing;
        end if;
    end if;

    return v_business_id;
end;
$function$;
