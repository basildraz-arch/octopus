-- ============================================================
-- 092 — أدمن المنصة يبطّل يشوف أصناف الناس في شاشاته العادية
-- ============================================================
--
-- الشكوى بالحرف (باسل، ١ سبتمبر ٢٠٢٦):
--
--   "انا مش محتاج اصناف كيرو تظهر عندي اصلا هو او غيره. انا عندي
--    اصناف تجريبية متسجلة علي اكونتي اجرب فيها براحتي، مش محتاج
--    اشوف او اتحكم في اصناف الناس."
--
-- الشريط الجانبي كان بيقول **"١٩٣ صنف"** - وde مجموع أصناف
-- **تمن محلات** مخلوطين في شاشة واحدة.
--
-- ------------------------------------------------------------
-- ده مكانش تسريب - كان أسوأ: خلط
-- ------------------------------------------------------------
--
-- policy اسمها `platform_admin_read` كانت متحطوطة على تسع جداول
-- عشان شاشة الماستر تشتغل. وهي بتدّي قراءة **لكل الصفوف في كل
-- المحلات**، وpolicies الـSELECT بتتجمع بـOR - يعني الـpolicy دي
-- كانت بتغلب العزل بتاع `get_my_business_id()` في **كل** استعلام،
-- مش في شاشة الماستر بس.
--
-- والنتيجة العملية إن باسل فتح صنف اسمه "7up" **من محل كيرو**
-- وحاول يعدّله تلات مرات، وفي كل مرة شاف رسالة نجاح والصنف
-- مااتغيّرش: القراءة عدّت بالـpolicy دي، والكتابة اترفضت بـ
-- `items_update` (اللي لسه بتشترط نفس المحل)، وPostgREST رجّع
-- **204** على UPDATE مامسّش ولا صف.
--
-- ------------------------------------------------------------
-- ليه شيلها آمن
-- ------------------------------------------------------------
--
-- شاشة الماستر **مابتعتمدش على الـpolicies دي أصلًا**. كل مساراتها
-- تحت `app/api/master/*` بتستعمل `adminClient` يعني مفتاح
-- `service_role`، وde بيتخطى الـRLS بالكامل. اتراجعت المسارات
-- واحد واحد قبل الشيل.
--
-- يعني الـpolicies دي كانت بتخدم **الشاشات العادية بالغلط** وبس.
--
-- ------------------------------------------------------------
-- بعد التطبيق (بحساب باسل نفسه)
-- ------------------------------------------------------------
--
--   ٩٣ صنف · ٤٣ فاتورة · ٢ مستخدم · ١ محل · ١٥ وردية
--
-- كلهم من محله هو. وقبلها كان بيشوف ١٩٣ صنف من ٨ محلات.
--
-- ملاحظة: الفلتر اللي في `repositories/item.repository.ts`
-- (`getItems(businessId)`) اتساب مكانه. هو **مش أمان** - الأمان
-- هنا في الملف ده - هو ترتيب، وبيفضل صح لو حد رجّع policy زي دي
-- بالغلط.

drop policy if exists platform_admin_read on public.items;
drop policy if exists platform_admin_read on public.sales;
drop policy if exists platform_admin_read on public.sale_items;
drop policy if exists platform_admin_read on public.shifts;
drop policy if exists platform_admin_read on public.categories;
drop policy if exists platform_admin_read on public.branches;
drop policy if exists platform_admin_read on public.roles;
drop policy if exists platform_admin_read on public.businesses;
drop policy if exists platform_admin_read on public.users;

-- التأكيد: لازم يرجّع صفر صفوف.
--
--   select tablename, policyname
--   from pg_policies
--   where schemaname = 'public'
--     and policyname = 'platform_admin_read';
