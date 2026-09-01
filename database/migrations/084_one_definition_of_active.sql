-- ٠٨٤ — تعريف واحد لـ"المحل ده مسموح له يكتب"
--
-- كان فيه تعريفين، وكانوا مختلفين فعلًا:
--
--   subscription_open() / business_is_active()
--       → التواريخ بس. **مابيبصّش على `businesses.active` خالص.**
--
--   is_business_owner() / has_permission() / has_read_permission()
--       → التواريخ **و** `b.active = true`
--
-- يعني محل موقوف من الماستر (`active=false`) بيرجّع:
--       has_permission        → false   ← مقفول
--       business_is_active    → true    ← مفتوح
--
-- اتأكدنا من ده على البيانات الحقيقية: تلات محلات `active=false`
-- (dopamine، سامح، بن لاكازا) و`business_is_active` بترجّع لهم true.
--
-- ليه ده مهم رغم إن المحلات دي مقفولة فعليًا دلوقتي:
--
-- الـpolicy اسمها `require_active_subscription` وهي الحارس الوحيد
-- المكتوب على الاشتراك في items وsales وsale_items وpurchases. اللي
-- بيوقف المحل الموقوف حاليًا هو **policy تانية** بتصادف إنها بتنادي
-- `has_permission`. يعني الحارس الحقيقي شغال بالصدفة، والحارس اللي
-- اسمه على الباب مش شايف الإيقاف.
--
-- وأول ما تتكتب policy جديدة معتمدة على `require_active_subscription`
-- لوحدها — أو دالة SECURITY DEFINER بتتخطى الـRLS وبتفحص
-- `business_is_active` زي `record_sale` — المحل الموقوف بيعدّي.
--
-- الإصلاح في الدالة الواحدة اللي التنين بيرجعوا لها، مش في كل policy.
-- ده مش تشديد للسلوك: النتيجة النهائية زي ما هي. ده بس بيخلي
-- السطر اللي مكتوب هو اللي بيحصل.
--
-- **قاعدة عامة:** لو نفس السؤال ("المحل ده شغال؟") ليه إجابتين في
-- القاعدة، الاتنين هيفترقوا. السؤال ياخد دالة واحدة.
--
-- اتأكدنا بعد التطبيق: التلات محلات الموقوفة بقت `business_is_active`
-- = false، ومحل كيرو (Qaaf) وبيزنس باسل التجريبي ماتأثروش.

create or replace function public.subscription_open(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from businesses b
    where b.id = p_business_id
      and b.active = true
      and (
        (b.subscription_expires_at is not null and b.subscription_expires_at > now())
        or (b.subscription_expires_at is null and b.trial_ends_at > now())
      )
  )
$$;

notify pgrst, 'reload schema';
