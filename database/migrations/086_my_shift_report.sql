-- ٠٨٦ — الكاشير يشوف شغله هو
--
-- ============================================================
-- الطلب
-- ============================================================
--
-- كيرو: "قدرة الكاشير على رؤية تقاريره والمخزون".
--
-- والوضع قبل ده: `view_reports` صلاحية واحدة بتفتح **كل حاجة** —
-- مبيعات المحل، الأرباح، التكاليف، وشغل كل زميل. فصاحب المحل قدامه
-- اختيارين بس: يدّي الكاشير كل ده، أو مايشوفش ولا رقم عن يومه هو.
--
-- الاتنين غلط. الكاشير محتاج يعرف باع بكام النهاردة عشان يعدّ الدرج
-- ويسلّم — وde مالوش علاقة بأرباح المحل.
--
-- ============================================================
-- التصميم: الحاجز مش الصلاحية
-- ============================================================
--
-- الدالة دي **مالهاش تحقق صلاحيات خالص**، لأنها مابترجّعش أي حاجة
-- تخص حد تاني: بتجمّع مبيعات **اللي بينادي** في **الوردية المفتوحة**
-- وبس.
--
-- ومش بترجّع تكلفة ولا ربح. الأرقام اللي فيها هي الأرقام اللي
-- الكاشير عارفها أصلًا لأنه هو اللي كتبها بإيده — إحنا بنجمّعها له
-- بدل ما يجمّعها على ورقة.
--
-- **لو اتضاف عمود ربح هنا في المستقبل، الدالة دي بتبقى ثغرة.**
-- الحاجز الوحيد هو محتوى الرد، فمحتوى الرد لازم يفضل زي ما هو.
--
-- ============================================================
-- ليه الوردية مش اليوم
-- ============================================================
--
-- الكاشير بيسلّم على وردية مش على يوم تقويمي. لو الشيفت بدأ ٦
-- المغرب وخلص ٢ بعد نص الليل، "مبيعات النهاردة" هتقسم شغله على
-- يومين وهو بيعدّ درج واحد.
--
-- ============================================================
-- الاختبار
-- ============================================================
--
--   كيرو (مالك، عنده وردية مفتوحة)  → فواتير=1 إجمالي=25 كاش=25  ✅
--   كاشير حسن (مابعش في ورديته)     → فواتير=0 إجمالي=0          ✅
--   محل مفيش فيه وردية مفتوحة       → مفيش صفوف                   ✅

create or replace function public.my_shift_report()
returns table (
    shift_id        uuid,
    opened_at       timestamptz,
    sale_count      bigint,
    total_sales     numeric,
    cash_sales      numeric,
    other_sales     numeric,
    credit_sales    numeric,
    my_expenses     numeric,
    expected_cash   numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_business uuid := get_my_business_id();
    v_me       uuid := my_user_id();
    v_shift    uuid;
    v_opened   timestamptz;
    v_count    bigint  := 0;
    v_total    numeric := 0;
    v_cash     numeric := 0;
    v_other    numeric := 0;
    v_credit   numeric := 0;
    v_exp      numeric := 0;
begin
    if v_business is null or v_me is null then
        return;
    end if;

    select s.id, s.opened_at into v_shift, v_opened
    from shifts s
    where s.business_id = v_business and s.closed_at is null
    order by s.opened_at desc
    limit 1;

    if v_shift is null then
        return;
    end if;

    -- تمريرة واحدة على مبيعات اللي بينادي في الوردية دي.
    select
        count(*),
        coalesce(sum(sa.total), 0),
        coalesce(sum(sa.total) filter (where sa.payment_method = 'cash'), 0),
        coalesce(sum(sa.total) filter (
            where sa.payment_method in ('vodafone_cash', 'instapay')), 0),
        coalesce(sum(sa.total) filter (where sa.payment_method = 'credit'), 0)
    into v_count, v_total, v_cash, v_other, v_credit
    from sales sa
    where sa.shift_id = v_shift
      and sa.business_id = v_business
      and sa.created_by = v_me;

    select coalesce(sum(e.amount), 0) into v_exp
    from expenses e
    where e.shift_id = v_shift
      and e.business_id = v_business
      and e.created_by = v_me;

    shift_id      := v_shift;
    opened_at     := v_opened;
    sale_count    := v_count;
    total_sales   := v_total;
    cash_sales    := v_cash;
    other_sales   := v_other;
    credit_sales  := v_credit;
    my_expenses   := v_exp;

    -- الكاش اللي المفروض في الدرج **من شغله هو**: البيع الكاش ناقص
    -- المصروفات اللي هو صرفها. الآجل مش داخل لأنه مادخلش الدرج.
    expected_cash := v_cash - v_exp;

    return next;
end;
$$;

revoke all on function public.my_shift_report() from public, anon;
grant execute on function public.my_shift_report() to authenticated;

notify pgrst, 'reload schema';
