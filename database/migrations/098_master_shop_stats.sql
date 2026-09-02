-- ============================================================
-- 098 — أرقام صحة المحلات، محسوبة في القاعدة
-- ============================================================
--
-- شاشة الماستر محتاجة لكل محل: كام صنف، كام صنف وصل الحد الأدنى،
-- كام موظف، مبيعات آخر ٣٠ يوم، آخر بيعة **من غير حد زمني**، أقدم
-- وردية لسه مفتوحة، وكام عربية اتسابت.
--
-- ------------------------------------------------------------
-- ليه دالة مش استعلامات في المسار
-- ------------------------------------------------------------
--
-- المسار الحالي بيجيب **كل صفوف** `items` و`users` و`sales` ويطوي
-- عليهم في الجافاسكريبت. ده شغّال دلوقتي (٨ محلات و١١٣ فاتورة)،
-- وبيقع مع أول محل بيبيع بجد: مية ألف فاتورة معناها ميجابايتات
-- بتتنقل عشان نطلع منها ٨ أرقام.
--
-- وفيه حاجة مالهاش حل في المتصفح أصلًا: **آخر بيعة من غير حد
-- زمني**. المسار بيفلتر آخر ٣٠ يوم، فالمحل اللي وقف من ٤٠ يوم
-- بيرجع بـ`lastSaleAt = null` - نفس شكل المحل اللي ماباعش ولا مرة.
-- والاتنين محتاجين مكالمة مختلفة تمامًا: واحد محتاج تعريف
-- بالبرنامج، والتاني محتاج إنقاذ قبل ما يمشي.
--
-- ------------------------------------------------------------
-- الصلاحية
-- ------------------------------------------------------------
--
-- بترجّع بيانات **كل المحلات**، فهي لأدمن المنصة بس. الحاجز
-- طبقتين زي باقي مسارات الماستر:
--
--   ١. `is_platform_admin()` جوه الدالة نفسها
--   ٢. `revoke` من `authenticated` — يعني حتى النداء المباشر من
--      المتصفح مابيوصلش
--
-- المسار بينادیها بمفتاح `service_role` بعد ما يكون اتأكد من هوية
-- الأدمن على السيرفر.

create or replace function public.master_shop_stats()
returns table (
    business_id       uuid,
    item_count        bigint,
    low_stock_count   bigint,
    employee_count    bigint,
    sales_30d_count   bigint,
    sales_30d_total   numeric,
    last_sale_at      timestamptz,
    open_shift_since  timestamptz,
    abandoned_carts   bigint
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    -- الحاجز الأول. الدالة مسحوبة من `authenticated` كمان، بس
    -- السطر ده بيفضل موجود عشان لو حد رجّع الـgrant بالغلط.
    if not is_platform_admin() and auth.role() <> 'service_role' then
        raise exception 'للإدارة بس';
    end if;

    return query
    select
        b.id,

        (select count(*) from items i where i.business_id = b.id),

        -- «وصل الحد الأدنى» بنفس الشرط اللي في شاشة الأصناف:
        -- بضاعة بتتتبع، ولها حد، والمخزون نزل عنده أو تحته.
        (select count(*) from items i
          where i.business_id = b.id and i.has_stock
            and i.minimum_stock > 0 and i.stock <= i.minimum_stock),

        (select count(*) from users u
          where u.business_id = b.id and u.role = 'employee' and u.active),

        (select count(*) from sales s
          where s.business_id = b.id and s.created_at >= now() - interval '30 days'),

        (select coalesce(sum(s.total), 0) from sales s
          where s.business_id = b.id and s.created_at >= now() - interval '30 days'),

        -- **من غير حد زمني** - ده بيت القصيد.
        (select max(s.created_at) from sales s where s.business_id = b.id),

        (select min(sh.opened_at) from shifts sh
          where sh.business_id = b.id and sh.closed_at is null),

        -- عربية اتحطّ فيها بضاعة، ومحصلش checkout، وسكتت نص ساعة.
        -- نفس تعريف `abandonedCarts` في
        -- `repositories/cartAudit.repository.ts` بالظبط - والسبب
        -- إن العربية اللي الكاشير واقف بيجهّزها دلوقتي **مش**
        -- مشبوهة، وde كان بينبّه غلط قبل ما يتصلّح.
        (select count(*) from (
            select c.cart_session_id
            from cart_audit_log c
            where c.business_id = b.id
              and c.created_at >= now() - interval '7 days'
            group by c.cart_session_id
            having count(*) filter (where c.action = 'add') > 0
               and count(*) filter (where c.action = 'checkout') = 0
               -- عرض السعر نهاية شرعية للعربية زي الفاتورة بالظبط.
               -- من غير السطر ده كيرو كان بيطلع بـ**٢٨** عربية
               -- مسابة في أسبوع بدل ٨: أغلبها كان هو نفسه بيتعلّم
               -- على البرنامج ويطبع عروض أسعار.
               and count(*) filter (where c.action = 'quote') = 0
               and max(c.created_at) < now() - interval '30 minutes'
        ) q)

    from businesses b;
end;
$$;

revoke all on function public.master_shop_stats() from public, anon, authenticated;
grant execute on function public.master_shop_stats() to service_role;

notify pgrst, 'reload schema';
