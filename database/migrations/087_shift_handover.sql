-- ٠٨٧ — تسليم الوردية بين زميلين
--
-- ============================================================
-- الطلب
-- ============================================================
--
-- كيرو: "تغيير الشيفت بينه وبين زميله".
--
-- الوضع قبل ده: الوردية بتتفتح تلقائيًا (`getOrCreateOpenShift`)
-- وبتفضل مفتوحة لحد ما حد معاه `close_day` يقفلها. مفيش أي مفهوم
-- اسمه "الوردية دي بتاعة مين دلوقتي".
--
-- والنتيجة اللي شفناها في بيانات قاف: **وردية واحدة فضلت ٧٤ ساعة**
-- (٢٨ ← ٣١ أغسطس) وفيها شغل أكتر من شخص. لما الدرج يتعدّ في الآخر،
-- مفيش طريقة تعرف مين كان مسؤول عن إيه.
--
-- ============================================================
-- التصميم: قفل + فتح، مش تعديل
-- ============================================================
--
-- التسليم هنا = **قفل الوردية القديمة بالكاش المعدود + فتح وردية
-- جديدة**، في عملية واحدة.
--
-- ليه مش مجرد تغيير "صاحب الوردية"؟ لأن ده كان هيخلّي حركة الدرج
-- بين الاتنين مستحيلة الفصل. الكاشير الأول بيعدّ ويوقّع، والتاني
-- بيبدأ من صفر معلوم. **ده الغرض كله من التسليم.**
--
-- والوردية القديمة بتتقفل بجرد فعلي - فتريجر `protect_closed_shift`
-- (ميجريشن ٠٨١) بيحميها من التعديل بعد كده زي أي يوم مقفول.
--
-- **والاتنين لازم يحصلوا مع بعض.** لو القفل نجح والفتح فشل، المحل
-- يفضل من غير وردية والكاشير التاني مش هيعرف يبيع. عشان كده هما
-- في دالة واحدة مش نداءين من المتصفح.
--
-- ============================================================
-- الصلاحية
-- ============================================================
--
-- `close_day` — نفس صلاحية قفل اليوم، لأن ده حرفيًا قفل يوم.
-- مش في دور الكاشير افتراضيًا؛ صاحب المحل بيدّيها للكاشير الأساسي
-- لو عايزه يسلّم من غير ما يستناه.
--
-- **الكاش المعدود إجباري.** تسليم من غير عدّ مش تسليم — هو بس
-- تمرير المسؤولية للتالي. (وde الفرق بينه وبين قفل اليوم، اللي
-- الجرد فيه اختياري لأن صاحب المحل هيعدّ بنفسه بعدين.)
--
-- ============================================================
-- الاختبار
-- ============================================================
--
--   كاشير من غير close_day     → "تسليم الوردية محتاج صلاحية قفل اليوم"  ✅
--   المالك يسلّم بـ1250.50      → الوردية القديمة اتقفلت بالرقم ده        ✅
--   وردية جديدة اتفتحت          → t                                       ✅
--   ورديات مفتوحة بعد التسليم   → ١ بالظبط (مفيش تكرار)                   ✅

create or replace function public.handover_shift(
    p_counted_cash numeric
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_business uuid := get_my_business_id();
    v_me       uuid := my_user_id();
    v_old      uuid;
    v_new      uuid;
begin
    if v_business is null or v_me is null then
        raise exception 'غير مصرّح';
    end if;

    if not business_is_active(v_business) then
        raise exception 'الاشتراك مقفول';
    end if;

    if not has_permission('close_day') then
        raise exception 'تسليم الوردية محتاج صلاحية قفل اليوم';
    end if;

    if p_counted_cash is null or p_counted_cash < 0 then
        raise exception 'اكتب الكاش اللي عدّيته في الدرج';
    end if;

    select s.id into v_old
    from shifts s
    where s.business_id = v_business and s.closed_at is null
    order by s.opened_at desc
    limit 1;

    if v_old is null then
        raise exception 'مفيش وردية مفتوحة تتسلّم';
    end if;

    update shifts
    set closed_at = now(),
        closed_by = v_me,
        counted_cash = p_counted_cash
    where id = v_old;

    insert into shifts (business_id) values (v_business)
    returning id into v_new;

    return v_new;
end;
$$;

revoke all on function public.handover_shift(numeric) from public, anon;
grant execute on function public.handover_shift(numeric) to authenticated;

notify pgrst, 'reload schema';
