-- 081 - اليوم المقفول مابيتعدّلش إلا من صاحب المحل.
--
-- ============================================================
-- المشكلة
-- ============================================================
--
-- `shifts_update` شرطها `has_permission('close_day')` وبس. الصلاحية
-- دي مع المدير (مش مع الكاشير العادي)، ومعناها **تقفل اليوم**. بس
-- الـpolicy مابتفرقش بين:
--
--   تقفل يوم مفتوح          ← ده اللي الصلاحية اتعملت عشانه
--   تفتح يوم مقفول تاني     ← ده بيمسح الجرد
--   تغيّر الكاش المعدود بعد القفل ← ده بيمسح دليل العجز
--
-- `reopenShift` في الكود بتعمل:
--
--     closed_at: null, closed_by: null, counted_cash: null
--
-- يعني مدير قفل اليوم ولقى عجز ٣٠٠ جنيه، يقدر يفتح اليوم تاني
-- ويقفله برقم مظبوط، والعجز يختفي من غير أي أثر.
--
-- **مش ثغرة صلاحيات** - المدير معاه الصلاحية فعلًا. دي مشكلة
-- **سلامة سجل**: الرقم اللي المفروض يمسك الحساب يقدر يتغيّر من اللي
-- الحساب عليه.
--
-- ولاحظ إن ده أخطر من إنه يبان: قفلة اليوم هي الحاجة الوحيدة اللي
-- بتربط الفلوس اللي في الدرج بالمبيعات المسجّلة. لو اترجعت، مفيش
-- حاجة تانية بتقول إن فيه عجز حصل.
--
-- ============================================================
-- الحل
-- ============================================================
--
-- تريجر على مستوى العمود - نفس نمط `protect_item_pricing_columns`
-- و`protect_user_identity_columns` (AGENTS §1).
--
-- **اللي لسه مسموح للمدير:** يقفل يوم مفتوح ويكتب الكاش المعدود.
-- ده شغله.
--
-- **اللي بقى للمالك بس:** يفتح يوم مقفول، أو يغيّر رقم اتكتب.
--
-- ليه تريجر مش policy: الـpolicy بتشوف الصف كله، والفرق هنا في
-- **إيه اللي اتغير** - `old.closed_at` مقارنة بـ`new.closed_at`.
-- ده اللي التريجر بيعمله.

create or replace function public.protect_closed_shift()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    -- service_role بيعدّي: الـwebhook والأدوات الإدارية بتعدّل بيه،
    -- وهو مش متاح من متصفح حد.
    if auth.role() = 'service_role' or is_business_owner() then
        return new;
    end if;

    -- اليوم لسه مفتوح: القفل مسموح لأي حد معاه close_day.
    if old.closed_at is null then
        return new;
    end if;

    if new.closed_at is null then
        raise exception 'فتح يوم مقفول تاني لصاحب النشاط بس';
    end if;

    if new.counted_cash is distinct from old.counted_cash then
        raise exception 'تعديل الكاش المعدود بعد القفل لصاحب النشاط بس';
    end if;

    if new.closed_at is distinct from old.closed_at
       or new.closed_by is distinct from old.closed_by then
        raise exception 'تعديل بيانات القفل لصاحب النشاط بس';
    end if;

    return new;
end;
$$;

comment on function public.protect_closed_shift() is
  'بتمنع أي حد غير صاحب المحل من فتح يوم مقفول أو تغيير الكاش المعدود بعد القفل. القفل نفسه لسه مسموح لأي حد معاه close_day.';

revoke all on function public.protect_closed_shift() from public, anon, authenticated;

drop trigger if exists trg_protect_closed_shift on public.shifts;

create trigger trg_protect_closed_shift
    before update on public.shifts
    for each row execute function public.protect_closed_shift();

notify pgrst, 'reload schema';
