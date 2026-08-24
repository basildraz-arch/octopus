-- 073 - الـview بتاعة التكلفة بقت للقراءة بس، ودوال التريجرات مابقتش
--       متاحة من الإنترنت.
--
-- ============================================================
-- الثغرة: موظف يقدر يمسح أصناف المحل، والحذف من حقه المالك بس.
-- ============================================================
--
-- item_costs (ميجريشن 069) اتعملت عشان **تحمي** التكلفة: عمود
-- items.buy_price ممنوع للقراءة، والـview هي الباب المسموح. عشان
-- تشتغل لازم تكون SECURITY DEFINER - يعني بتتنفّذ بصلاحيات مالك
-- الـview (postgres)، فبتتخطى الـRLS بتاعة items بالكامل.
--
-- اللي فات ده صح للقراءة. المشكلة إن الـview دي **قابلة للكتابة
-- تلقائيًا** (select بسيط من جدول واحد من غير join ولا group by)،
-- وPostgREST كان مديها INSERT وUPDATE وDELETE للدور authenticated.
--
-- والنتيجة إن الـRLS بتتقفل من الباب وبتفضل مفتوحة من الشباك:
--
--   policy items_owner_delete:  DELETE للمالك بس
--   delete from items      →  ٠ صفوف (اتقفلت صح)
--   delete from item_costs →  ١ صف   (عدّت)
--
-- ده مش تحليل، ده اللي حصل فعلًا في الاختبار. بحساب موظف حقيقي
-- (role = employee، is_business_owner() = false) معاه صلاحية
-- receive_stock:
--
--   is_owner                  false
--   direct_delete_items       0 rows     ← الـRLS شغالة
--   after_direct_still_there  1          ← الصنف لسه موجود
--   delete_via_view           1 row      ← اتمسح
--
-- أي أمين مخزن (stock_keeper معاه receive_stock) أو مدير موظف
-- (manager معاه manage_items وview_reports) بيعدّي شرط الـview،
-- فبيقدر يفضّي كتالوج المحل كله بطلب واحد.
--
-- **لسه ماحصلش**: مفيش ولا حساب في القاعدة دلوقتي غير مالكين
-- وكاشيرات، والكاشير مابيعديش شرط الـview أصلًا (اتجرّب: صفر صفوف
-- في القراءة والكتابة والحذف). بس أول أمين مخزن يتعمل لكيرو،
-- الباب بيبقى مفتوح.
--
-- الدرس - وهو امتداد لقاعدة AGENTS §1: **الـview اللي بتتخطى الـRLS
-- عشان تقرا، بتتخطاها عشان تكتب كمان.** لازم تتقفل صراحةً.
--
-- ملحوظة على اللي **ما**عدّاش: تعديل business_id من خلال الـview
-- (نقل صنف لمحل تاني) اترفض - لأن protect_item_pricing_columns
-- تريجر على الجدول نفسه، والتريجرات بتشتغل حتى لو الكتابة جاية من
-- view. ده بالظبط سبب وجود طبقة التريجرات في §1. الحذف مالوش تريجر،
-- عشان كده عدّى.

revoke all on public.item_costs from public, anon, authenticated;

grant select on public.item_costs to authenticated;

comment on view public.item_costs is
  'قراءة فقط. SECURITY DEFINER عشان تعدّي منع القراءة على items.buy_price - وde معناه إنها بتتخطى RLS، فالكتابة من خلالها لازم تفضل مقفولة (ميجريشن 073).';

-- ============================================================
-- دوال التريجرات مالهاش لازمة على الإنترنت
-- ============================================================
--
-- تلات دوال تريجر كانت متاحة لـanon وauthenticated على
-- /rest/v1/rpc/<name>. مناداتها مباشرة بترمي خطأ من Postgres
-- ("can only be called as trigger")، فمفيش استغلال معروف - بس
-- المساحة المكشوفة من غير سبب بتتقفل. نفس مصيدة §1: PUBLIC بياخد
-- EXECUTE افتراضيًا، فـ"revoke from anon" لوحده مابيعملش حاجة.

revoke all on function public.items_derive_stock_and_cost() from public, anon, authenticated;
revoke all on function public.protect_employee_email_code()  from public, anon, authenticated;
revoke all on function public.protect_subscription_columns() from public, anon, authenticated;

notify pgrst, 'reload schema';
