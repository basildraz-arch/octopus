-- 082 - تقرير: كل صنف كسّب كام.
--
-- ============================================================
-- ليه دي أرخص فيتشر في الخريطة
-- ============================================================
--
-- البيانات موجودة كلها خلاص. `sale_items.cost` بتتكتب مع كل سطر
-- فاتورة من ميجريشن ٠٧١ - تكلفة FIFO الحقيقية وقت البيع، مش متوسط
-- تقريبي بعدين. يعني الربح الحقيقي لكل صنف محسوب من زمان، ومحدش
-- بيعرضه.
--
-- ودي كمان الحاجة اللي بتحوّل البرنامج من "مسجّل مبيعات" لـ"بيقولي
-- أعمل إيه": صاحب المحل بيعرف بيبيع إيه، بس نادرًا بيعرف بيكسب من
-- إيه. الصنف اللي بيتباع كتير مش دايمًا اللي بيكسّب.
--
-- ============================================================
-- ليه دالة مش استعلام من المتصفح
-- ============================================================
--
-- ١. **الصلاحية.** `view_reports` بتتفحص هنا مرة واحدة. لو الجمع
--    اتعمل في المتصفح، الحماية بتبقى في الـRLS بتاعة `sale_items`
--    (`created_by = my_user_id()` للي مالوش صلاحية) - وde معناه إن
--    الكاشير هيشوف تقرير **بيعاته هو** ويفتكره تقرير المحل.
--    الرقم الناقص أخطر من رسالة "ممنوع".
--
-- ٢. **الحجم.** الجمع في المتصفح معناه تنزيل كل سطور الفواتير في
--    الفترة. محل بيبيع ٢٠٠ فاتورة في اليوم = ٦ آلاف سطر في الشهر
--    تتنقل عشان يطلع منها ٢٠ سطر.
--
-- ٣. **الأصناف الممسوحة.** `sale_items.item_id` بيفضل مشاور على صنف
--    اتمسح. الـjoin هنا `left join` عشان بيعات صنف قديم ما تختفيش من
--    التقرير - بتظهر باسم "صنف متمسوح".

create or replace function public.profit_by_item(
    p_from date,
    p_to   date
)
returns table (
    item_id    uuid,
    item_name  text,
    quantity   numeric,
    revenue    numeric,
    cost       numeric,
    profit     numeric,
    margin     numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
    v_business uuid := get_my_business_id();
begin
    if v_business is null then
        raise exception 'غير مصرّح';
    end if;

    -- بترمي، مابترجعش فاضي. AGENTS §1: "ما تخليش دالة ترجّع لأ عند
    -- خطأ" - وتقرير فاضي بيتقري "مفيش أرباح" مش "مش من حقك".
    if not has_read_permission('view_reports') then
        raise exception 'التقرير ده لصاحب النشاط أو مين معاه صلاحية التقارير';
    end if;

    return query
    select
        si.item_id,
        coalesce(i.name, 'صنف متمسوح')                      as item_name,
        sum(si.quantity)                                     as quantity,
        round(sum(si.total), 2)                              as revenue,
        round(sum(coalesce(si.cost, 0)), 2)                  as cost,
        round(sum(si.total - coalesce(si.cost, 0)), 2)       as profit,
        -- هامش الربح كنسبة من البيع. القسمة على صفر بترجّع null -
        -- خدمة اتباعت ببلاش مالهاش هامش، وصفر هيبقى كذب.
        case when sum(si.total) > 0
             then round(sum(si.total - coalesce(si.cost, 0)) * 100 / sum(si.total), 1)
             else null
        end                                                  as margin
    from sale_items si
    join sales s on s.id = si.sale_id
    left join items i on i.id = si.item_id
    where s.business_id = v_business
      and s.created_at >= p_from::timestamptz
      and s.created_at <  (p_to + 1)::timestamptz
    group by si.item_id, i.name
    order by 6 desc;   -- الأكتر ربحًا الأول
end;
$$;

comment on function public.profit_by_item(date, date) is
  'ربح كل صنف في فترة، من sale_items.cost المكتوبة وقت البيع. محتاجة صلاحية view_reports وبترمي لو مش موجودة.';

revoke all on function public.profit_by_item(date, date) from public, anon;
grant execute on function public.profit_by_item(date, date) to authenticated;

notify pgrst, 'reload schema';
