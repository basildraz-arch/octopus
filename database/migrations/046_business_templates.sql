-- ==========================================
-- OCTOPUS ERP
-- Migration 046: business type templates
--
-- WHY THIS EXISTS
-- Not every shop works the same way. A coffee shop needs running
-- customer tabs; a clothes shop doesn't. A supermarket that sells
-- wholesale needs three price tiers; a barber never will. Until now
-- every new business was created with business_type = 'other' and
-- whatever features the signup wizard happened to send, so everyone
-- got the same screen and the owner had to hide what he didn't need.
--
-- A template says: "for THIS kind of business, these are the right
-- features, these are the right price-tier names, this is the paper
-- size, and these are sensible starter categories." Signup applies
-- one automatically. The platform admin edits them from Master.
--
-- SECURITY
-- Templates are configuration, not data - every signed-in user may
-- read them (the signup wizard needs them). Only a platform admin
-- may write, enforced by a real RLS policy calling is_platform_admin()
-- (migration 031), not by hiding a button.
-- ==========================================

create table if not exists business_templates (
    business_type text primary key,

    label text not null,
    icon text not null default '🏪',
    description text not null default '',

    -- What the app looks like for this kind of business.
    enabled_features text[] not null default '{}',
    app_mode text not null default 'retail'
        check (app_mode in ('retail', 'warehouse_management')),

    price_tier_labels text[] not null
        default array['سعر 1', 'سعر 2', 'سعر 3']
        check (array_length(price_tier_labels, 1) = 3),

    receipt_paper text not null default 'thermal_80'
        check (receipt_paper in ('thermal_58', 'thermal_80', 'a4')),

    force_print_on_sale boolean not null default true,

    -- Starter categories created with the business so the owner
    -- isn't staring at an empty screen on day one.
    default_categories text[] not null default '{}',

    sort_order integer not null default 100,
    active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table business_templates enable row level security;

drop policy if exists business_templates_read on business_templates;
create policy business_templates_read
    on business_templates
    for select
    to authenticated
    using (true);

-- Writes: platform admin only. Split per command so nothing is
-- granted implicitly by a FOR ALL policy.
drop policy if exists business_templates_admin_insert on business_templates;
create policy business_templates_admin_insert
    on business_templates
    for insert
    to authenticated
    with check (is_platform_admin());

drop policy if exists business_templates_admin_update on business_templates;
create policy business_templates_admin_update
    on business_templates
    for update
    to authenticated
    using (is_platform_admin())
    with check (is_platform_admin());

drop policy if exists business_templates_admin_delete on business_templates;
create policy business_templates_admin_delete
    on business_templates
    for delete
    to authenticated
    using (is_platform_admin());

-- ------------------------------------------
-- Seed
-- ------------------------------------------
insert into business_templates
    (business_type, label, icon, description, enabled_features,
     price_tier_labels, default_categories, sort_order)
values
    ('coffee', 'كافيه / كوفي شوب', '☕',
     'مشروبات وحلويات، وفيه زباين بياخدوا على مدار اليوم ويحاسبوا في الآخر',
     array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers'],
     array['سعر 1','سعر 2','سعر 3'],
     array['مشروبات ساقعة','مشروبات سخنة','حلويات','سناكس'], 10),

    ('restaurant', 'مطعم', '🍽️',
     'أكل وطلبات، مع إمكانية حساب مؤجل للزباين الدايمين',
     array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers'],
     array['سعر 1','سعر 2','سعر 3'],
     array['أطباق رئيسية','مقبلات','مشروبات','حلويات'], 20),

    ('supermarket', 'سوبر ماركت / بقالة', '🛒',
     'بيع قطاعي وجملة، فيه تسعيرات مختلفة حسب نوع الزبون',
     array['pos_sales','inventory','categories','shifts','sales_reports','discounts','price_tiers','credit_customers'],
     array['قطاعي','نص جملة','جملة'],
     array['بقالة','ألبان','منظفات','مشروبات','مجمدات'], 30),

    ('pharmacy', 'صيدلية', '💊',
     'أدوية ومستحضرات، مع حسابات للزباين الدايمين',
     array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
     array['سعر 1','سعر 2','سعر 3'],
     array['أدوية','مستحضرات تجميل','مستلزمات طبية','ألبان أطفال'], 40),

    ('pet_shop', 'محل حيوانات أليفة', '🐾',
     'أكل وإكسسوارات ومستلزمات للحيوانات',
     array['pos_sales','inventory','categories','shifts','sales_reports','discounts'],
     array['سعر 1','سعر 2','سعر 3'],
     array['أكل','إكسسوارات','أدوية','ألعاب'], 50),

    ('barber', 'كوافير / حلاق', '💈',
     'خدمات بالدرجة الأولى، مع بيع منتجات على الجنب',
     array['pos_sales','inventory','categories','shifts','sales_reports'],
     array['سعر 1','سعر 2','سعر 3'],
     array['خدمات','منتجات شعر','منتجات بشرة'], 60),

    ('clothing', 'محل ملابس', '👕',
     'ملابس بمقاسات وألوان، والخصم بيحصل كتير',
     array['pos_sales','inventory','categories','shifts','sales_reports','discounts'],
     array['سعر 1','سعر 2','سعر 3'],
     array['رجالي','حريمي','أطفال','أحذية'], 70),

    ('electronics', 'محل إلكترونيات', '📱',
     'أجهزة وإكسسوارات، وفيه زباين بياخدوا بالتقسيط أو على الحساب',
     array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers'],
     array['سعر 1','سعر 2','سعر 3'],
     array['موبايلات','إكسسوارات','أجهزة منزلية','قطع غيار'], 80),

    ('workshop', 'ورشة / صيانة', '🔧',
     'شغل بأمر تشغيل وقطع غيار، والحساب بيتقفل بعد ما الشغل يخلص',
     array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
     array['سعر 1','سعر 2','سعر 3'],
     array['قطع غيار','مصنعية','زيوت ومواد'], 90),

    ('general_store', 'محل عام', '🏪',
     'الأساسيات: بيع، أصناف، تقارير، وحساب مؤجل لو احتجته',
     array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
     array['سعر 1','سعر 2','سعر 3'],
     array['أصناف عامة'], 100),

    ('other', 'نشاط تاني', '📋',
     'الأساسيات بس - وتقدر تزوّد اللي إنت محتاجه بعدين',
     array['pos_sales','inventory','categories','shifts','sales_reports'],
     array['سعر 1','سعر 2','سعر 3'],
     array[]::text[], 999)
on conflict (business_type) do nothing;

-- ------------------------------------------
-- Signup now applies a template
-- ------------------------------------------
--
-- Two fixes ride along here:
--
--   1. 'credit_customers' was never added to the allowed-features
--      list when migration 042 introduced it, so a signup that
--      switched it on would have been rejected outright.
--   2. business_type was hardcoded to 'other' for every business
--      ever created, which is exactly what made one-size-fits-all
--      screens unavoidable.
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
    v_business_type text;
    v_enabled_features text[];
    v_app_mode text;
    v_business_id uuid;
    v_template business_templates%rowtype;
    v_category text;
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

    -- An employee login issued by a shop cannot turn itself into an
    -- independent business (migration 034).
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
    where business_type = v_business_type
      and active;

    if not found then
        v_business_type := 'other';

        select * into v_template
        from business_templates
        where business_type = 'other';
    end if;

    -- The wizard may still send an explicit feature list (the owner
    -- ticked boxes himself). If it doesn't, the template decides.
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
        'pos_sales',
        'inventory',
        'categories',
        'shifts',
        'sales_reports',
        'multi_warehouse',
        'warehouse_reports',
        'discounts',
        'price_tiers',
        'english_receipt',
        'credit_customers'
    ]::text[]) then
        raise exception 'قيمة ميزة غير صالحة';
    end if;

    v_app_mode := case
        when 'multi_warehouse' = any(v_enabled_features) then 'warehouse_management'
        else coalesce(v_template.app_mode, 'retail')
    end;

    insert into businesses (
        name, business_type, app_mode, trial_ends_at, enabled_features,
        price_tier_labels, receipt_paper, force_print_on_sale
    )
    values (
        v_business_name,
        v_business_type,
        v_app_mode,
        now() + interval '7 days',
        v_enabled_features,
        coalesce(v_template.price_tier_labels, array['سعر 1','سعر 2','سعر 3']),
        coalesce(v_template.receipt_paper, 'thermal_80'),
        coalesce(v_template.force_print_on_sale, true)
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

    -- Starter categories, so day one isn't an empty screen.
    if v_template.default_categories is not null then
        foreach v_category in array v_template.default_categories loop
            insert into categories (business_id, name)
            values (v_business_id, v_category);
        end loop;
    end if;

    return v_business_id;
end;
$$;

revoke execute on function complete_signup() from public, anon;
grant execute on function complete_signup() to authenticated;
