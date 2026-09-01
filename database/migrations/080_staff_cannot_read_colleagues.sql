-- 080 - الموظف مابقاش يقرا بيانات زمايله ولا الرقم السري المعلّق.
--
-- الاتنين اتلقوا بمصفوفة قراءة: جرّبنا `select count(*)` على **كل**
-- جدول في القاعدة بحساب كاشير حقيقي، وبصّينا على اللي رجّع صفوف.
-- (الطريقة دي أحسن من قراءة الـpolicies واحدة واحدة - بتوريك اللي
-- بيحصل فعلًا مش اللي إنت فاكره.)
--
-- ============================================================
-- ١. الكاشير كان بيقرا إيميل صاحب المحل
-- ============================================================
--
-- `users_read_own_business` شرطها `business_id = get_my_business_id()`
-- وبس. يعني أي موظف بيقرا **صف كل زمايله كامل**: الاسم والإيميل
-- والتليفون والدور والصلاحيات - وإيميل المالك نفسه.
--
-- اتجرّب بحساب الكاشير ورجّع:
--
--   Basil | basildraz@gmail.com | owner
--   طارق محمد | tarek@gg.octopus.local | 0100035546987 | employee
--
-- إيميل المالك هو **نص بيانات دخوله**. والكاشير مالوش أي سبب يشوفه.
-- ولو ده حصل عند كيرو، كل واحد بيقف على الكاشير عنده هيشوف إيميله
-- الشخصي.
--
-- مش ثغرة تدي صلاحية، بس هي بيانات شخصية مكشوفة من غير داعي وبتفتح
-- باب تصيّد موجّه على المالك.
--
-- الحل: الموظف العادي يشوف **صفه هو بس**. اللي معاه صلاحية تقارير
-- (مدير) يشوف الكل - محتاج الأسماء لتقرير الموظفين. والمالك يشوف
-- الكل طبعًا.
--
-- اتأكدنا من أماكن القراءة الأربعة قبل التضييق:
--   getUserByAuthId       صفه هو (بيفلتر بـauth_user_id) ✓
--   getEmployees          شاشة الموظفين، للمالك ✓
--   report.repository     تقرير الموظفين، محتاج view_reports ✓
--   requireBusinessOwner  بيشتغل بservice role ✓

drop policy if exists users_read_own_business on public.users;

create policy users_read_own_business on public.users
    for select using (
        business_id = get_my_business_id()
        and (
            is_business_owner()
            or has_read_permission('view_reports')
            or id = my_user_id()
        )
    );

-- ============================================================
-- ٢. الرقم السري المعلّق كان مكشوف لكل الموظفين
-- ============================================================
--
-- `employee_approval_requests` فيها `pin_hash` - تجزئة الرقم السري
-- بتاع الموظف الجديد، مستنية موافقة باسل. والـpolicy كانت بتخلي أي
-- حد في المحل يقراها.
--
-- الرقم السري ٤ أرقام = ١٠ آلاف احتمال بس. تجزئة scrypt في إيد حد
-- عنده الملف بتتكسر في ثواني على أي لابتوب. يعني كاشير موجود يقدر
-- يقرا تجزئة زميله الجديد، يطلّع رقمه السري، ويستنى الموافقة عشان
-- يدخل باسمه.
--
-- **ماحصلش**: كل الصفوف الموجودة `pin_hash` فيها فاضي - بيتمسح بعد
-- الموافقة. النافذة هي بين إرسال الطلب وموافقة باسل بس. بس دي حماية
-- بالسلوك مش بالبناء، والسلوك بيتغير.
--
-- طبقتين زي ما §1 بتقول:
--   أ) الـpolicy: الطلبات للمالك وأدمن المنصة بس
--   ب) صلاحية العمود: pin_hash ممنوع قراءته من authenticated كله
--
-- (ب) مش زيادة على (أ): لو حد ضيّف policy جديدة بعدين ونسي الموضوع
-- ده، منع العمود بيفضل واقف.

drop policy if exists read_requests on public.employee_approval_requests;

create policy read_requests on public.employee_approval_requests
    for select using (
        (business_id = get_my_business_id() and is_business_owner())
        or is_platform_admin()
    );

-- منع العمود. **لازم revoke على الجدول الأول** - منع عمود من دور
-- معاه صلاحية على الجدول كله مابيعملش حاجة وpostgres مابيشتكيش
-- (نفس المصيدة المكتوبة في AGENTS §1، ونفس اللي عملناه مع
-- items.buy_price في 070).
revoke select on public.employee_approval_requests from authenticated, anon;

grant select (
    id, business_id, requested_by, full_name, phone, branch_id,
    generated_email, status, reviewed_by, reviewed_at, rejection_reason,
    created_user_id, created_at, updated_at, staff_role, extra_permissions
) on public.employee_approval_requests to authenticated;

-- **الكود لازم يتغيّر معاها:** `select("*")` على الجدول ده هيفشل
-- دلوقتي زي ما حصل مع items. اتغيّر في
-- repositories/employeeApprovalRequest.repository.ts لقايمة أعمدة
-- صريحة. أي عمود جديد في الجدول لازم يتضاف في المكانين.

notify pgrst, 'reload schema';
