-- ==========================================
-- OCTOPUS ERP
-- Migration 056: every shop gets to use its own words
--
-- A café says "مشروبات". A spare-parts shop says "قطع". A pharmacy
-- says "أدوية". The app said "الأصناف" to all of them, which is how
-- software announces that it was written for somebody else.
--
-- ui_labels holds only the words a shop wanted changed; everything
-- else falls back to the app's defaults when the screen is drawn. So
-- an empty object is a perfectly normal, complete state - there is no
-- migration to backfill and nothing to keep in sync.
--
-- WHO CAN CHANGE THEM
-- The platform admin, through the service role, and nobody else. This
-- is the same shape as migration 049: what the shop CONTAINS is the
-- owner's business, what the app LOOKS LIKE is the platform's. The
-- trigger is what enforces it - not the absence of a screen.
-- ==========================================

alter table businesses
    add column if not exists ui_labels jsonb not null default '{}'::jsonb;

alter table business_templates
    add column if not exists ui_labels jsonb not null default '{}'::jsonb;

-- Starting words per kind of shop. These seed a new business at
-- signup and are never read again at runtime.
update business_templates set ui_labels = '{"items":"المشروبات","categories":"الأقسام","sale":"طلب"}'::jsonb where business_type = 'coffee';
update business_templates set ui_labels = '{"items":"الأكلات","categories":"الأقسام","sale":"طلب"}'::jsonb where business_type = 'restaurant';
update business_templates set ui_labels = '{"items":"الأدوية","categories":"الأقسام"}'::jsonb where business_type = 'pharmacy';
update business_templates set ui_labels = '{"customers":"الزباين"}'::jsonb where business_type in ('supermarket', 'general_store');
update business_templates set ui_labels = '{"items":"الخدمات","categories":"أنواع الخدمة","sale":"خدمة"}'::jsonb where business_type = 'barber';
update business_templates set ui_labels = '{"items":"المنتجات"}'::jsonb where business_type = 'pet_shop';
update business_templates set ui_labels = '{"items":"قطع وخدمات","sale":"أمر شغل"}'::jsonb where business_type = 'workshop';
update business_templates set ui_labels = '{"items":"المنتجات","stock":"البضاعة"}'::jsonb where business_type = 'electronics';
update business_templates set ui_labels = '{"items":"القطع","stock":"البضاعة"}'::jsonb where business_type = 'clothing';

create or replace function protect_ui_labels()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if new.ui_labels is distinct from old.ui_labels
       and auth.role() <> 'service_role' then
        raise exception 'تغيير أسماء الشاشات بيتم من الإدارة';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_protect_ui_labels on businesses;

create trigger trg_protect_ui_labels
before update on businesses
for each row execute function protect_ui_labels();

revoke execute on function protect_ui_labels() from public, anon, authenticated;
