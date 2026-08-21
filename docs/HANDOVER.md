# تسليم شغل الأخطبوط — أغسطس ٢٠٢٦

ملف تسليم كامل لأي حد هيكمّل على المشروع. كل اللي تحت متأكَّد منه من
قاعدة البيانات الحقيقية ومن ملفات المشروع مباشرة، مش من الذاكرة.

- **المشروع:** Next.js 15.5.20 + Supabase (`doitwgwvmuupygpitkfo`)
- **المستودع:** `github.com/basildraz-arch/octopus` — فرع `master`
- **آخر commit:** `4f86849`
- **الموقع:** https://octopus-octopus-team1.vercel.app

---

## ١. الحالة: هل الشغل مرفوع؟

**أيوة، كله مرفوع ومنشور.**

| الحاجة | الحالة |
|---|---|
| Commit محلي | ✅ اتعمل |
| Push على GitHub | ✅ `ce4e718 → 4f86849` |
| النشر على Vercel | ✅ عن طريق `npx vercel --prod` |
| ميجريشنز Supabase | ✅ كلها متطبّقة على القاعدة الحقيقية |
| `npm run build` | ✅ عدّى — ٥٠ صفحة |
| `npx tsc --noEmit` | ✅ صفر أخطاء |

**ملحوظة مهمة للي هيكمّل:** مشروع Vercel **مش مربوط بـGitHub**. الـ`git push`
لوحده **ما بينشرش**. النشر لازم `npx vercel --prod` من مجلد المشروع.
(الأفضل تربطه: Vercel ← octopus ← Settings ← Git ← Connect Git Repository).

---

## ٢. ميجريشنز قاعدة البيانات

**٣٤ ميجريشن، من `031` لـ `064`.** كلها **متطبّقة فعليًا** على Supabase
ومتحفوظة في `database/migrations/`.

### الصلاحيات وحسابات الموظفين
- `031_platform_admins` — جدول `platform_admins` منفصل + `is_platform_admin()`
- `032_employee_approval_requests` — طلبات حسابات الموظفين
- `033_tighten_is_platform_admin_grants` — سحب صلاحية التنفيذ من `anon`
- `034_employee_accounts_ownership_and_privilege_fix` — ⚠ **متجاوَز جزئيًا بـ039**
- `036_employee_pins` — أرقام سرية للكاشير (RLS من غير أي policy = deny-all)
- `037_pin_on_approval_request` — الرقم السري يتحدد وقت الطلب
- `039_fix_complete_signup_regression` — إصلاح تراجع حصل في 034

### البيع والمخزون
- `035_cart_audit_log` — سجل الفواتير المفتوحة (append-only) — **ميزة مضاد السرقة**
- `038_price_tiers` — ٣ تسعيرات لكل صنف
- `040_receipt_settings` — مقاس ورق الفاتورة
- `041_print_policy` — إجبار الطباعة عند البيع
- `042_credit_customers` — حساب مؤجل للعملاء
- `053_draw_stock_fifo_rpc` — **مهم:** سحب المخزون FIFO اتنقل من المتصفح لدالة في القاعدة

### الأمان
- `043_platform_admin_actions` — سجل إجراءات الإدارة
- `044_lock_down_write_access` — **إصلاح ٤ ثغرات حقيقية** (تفاصيلها تحت)
- `045_harden_functions` — تثبيت `search_path` وسحب صلاحيات
- `052_tighten_change_request_read` — الكاشير مبقاش يشوف طلبات صاحب النشاط
- `055_harden_new_functions` — تشديد الدوال الجديدة

### تخصيص الواجهة لكل نشاط
- `046_business_templates` — ١١ قالب نوع نشاط
- `047_staff_roles` — أدوار الموظفين + `has_permission()`
- `048_notifications` — التنبيهات + دالة `notify()`
- `049_change_requests` — طلبات التعديل اللي بترجع للإدارة
- `050_business_templates_public_read`
- `054_notify_abandoned_cart` — تنبيه تلقائي للفاتورة اللي اتفتحت وماتنفذتش
- `056_per_business_ui_labels` — كل محل بيسمي شغله بكلماته
- `057_signup_copies_ui_labels`

### الأخطبوط الذكي
- `051_assistant_actions` — سجل أوامر المساعد (append-only)

### الإحالات والتسعير
- `058_referrals` — أكواد إحالة + إحالات + مدفوعات
- `059_signup_records_referral` — كود التسجيل هو كود الإحالة
- `060_plans` — ⚠ **متجاوَز بالكامل بـ062** (جدول `plans` اتمسح)
- `061_plan_limits` — حدود الموظفين والمخازن والفروع (triggers)
- `062_price_per_module` — **التسعير الحالي:** سعر لكل قايمة بدل الباقات
- `063_reset_limits_to_reality` — تصحيح الحدود بعد إلغاء الباقات
- `064_referral_default_200` — مكافأة الإحالة ٢٠٠ ج × ١٢ شهر

---

## ٣. الملفات اللي اتعملت أو اتعدّلت

### ملفات جديدة

**`lib/`**
```
lib/billing.ts                 lib/pricing.ts
lib/csv.ts                     lib/rateLimit.ts
lib/employeeEmail.ts           lib/requireBusinessOwner.ts
lib/importCatalog.ts           lib/requirePlatformAdmin.ts
lib/permissions.ts             lib/uiLabels.ts
lib/pin.ts                     lib/xlsx.ts
lib/pinRules.ts                lib/assistant/commands.ts
lib/priceTier.ts               lib/monthlyDue.ts
lib/referralRules.ts
```

**`repositories/`**
```
repositories/businessTemplate.repository.ts
repositories/cartAudit.repository.ts
repositories/catalogImport.repository.ts
repositories/changeRequest.repository.ts
repositories/customer.repository.ts
repositories/employeeApprovalRequest.repository.ts
repositories/notification.repository.ts
repositories/platformAdmin.repository.ts
repositories/pricing.repository.ts
repositories/referral.repository.ts
```

**`services/`**
```
services/assistantCommand.service.ts
services/catalogImport.service.ts
services/employeeApprovalRequest.service.ts
services/master.service.ts
```

**`types/`**
```
types/businessTemplate.ts      types/pricing.ts
types/changeRequest.ts         types/referral.ts
types/customer.ts              types/notification.ts
types/employeeApprovalRequest.ts
types/platformAdmin.ts
```

**`app/api/` (كلها جديدة)**
```
app/api/assistant/route.ts
app/api/assistant/execute/route.ts
app/api/auth/pin-login/route.ts
app/api/auth/shop-staff/route.ts
app/api/employees/approve/route.ts
app/api/employees/pin-status/route.ts
app/api/employees/reject/route.ts
app/api/employees/request/route.ts
app/api/employees/reset-password/route.ts
app/api/employees/set-pin/route.ts
app/api/master/business/route.ts
app/api/master/change-request/route.ts
app/api/master/overview/route.ts
app/api/master/referral/route.ts
```

**صفحات جديدة**
```
app/(auth)/login/employee/page.tsx      شاشة دخول الكاشير بالرقم السري
app/(dashboard)/customers/page.tsx      حسابات العملاء المؤجلة
app/(dashboard)/employee-requests/page.tsx
app/(dashboard)/employees/page.tsx
app/(dashboard)/import/page.tsx         استيراد كتالوج من إكسل
app/(dashboard)/master/page.tsx         لوحة الإدارة
app/(dashboard)/notifications/page.tsx
app/(dashboard)/sales-audit/page.tsx    سجل الفواتير المفتوحة
```

**مكونات جديدة**
```
components/master/ReferralPanel.tsx
components/master/ScreenPreview.tsx
components/settings/ExportData.tsx
components/layout/NotificationBell.tsx
```

**توثيق**
```
docs/SECURITY_REVIEW_2026-08.md    مراجعة أمنية كاملة
docs/UPDATE_2026-08_AR.md          شرح الفيتشرز وخطوات تجربتها
docs/DEPLOY.md                     خطوات الرفع والمفاتيح المطلوبة
docs/HANDOVER.md                   الملف ده
docs/octopus-map.html              خريطة كل الشاشات ومين بيشوفها
pitch/octopus-pitch.html           صفحة عرض للعملاء
pitch/video-script.md              سكريبت فيديو تسويقي
```

### ملفات اتعدّلت

```
lib/examples.ts                 lib/features.ts
lib/navItems.ts (اتعاد كتابته)   lib/tempPassword.ts
repositories/auth.repository.ts          repositories/business.repository.ts
repositories/report.repository.ts        repositories/sale.repository.ts
repositories/shift.repository.ts         repositories/stockBatch.repository.ts
repositories/stockTransfer.repository.ts repositories/user.repository.ts
services/auth.service.ts
types/business.ts   types/item.ts   types/sale.ts   types/user.ts
components/Cart.tsx          components/ItemList.tsx
components/Receipt.tsx       components/SalePopup.tsx
components/assistant/AssistantChat.tsx
components/items/form/ItemForm.tsx
components/layout/AppHeader.tsx   components/layout/BottomNav.tsx
components/layout/Navigation.tsx
app/(auth)/signup/page.tsx
app/(dashboard)/layout.tsx    app/(pos)/layout.tsx
app/(dashboard)/categories/page.tsx    app/(dashboard)/dashboard/page.tsx
app/(dashboard)/day-close/page.tsx     app/(dashboard)/items/page.tsx
app/(dashboard)/reports/page.tsx       app/(dashboard)/settings/page.tsx
app/(dashboard)/warehouses/page.tsx    app/(pos)/sales/page.tsx
app/api/signup/verify-invite/route.ts
app/api/paymob/create-payment/route.ts
app/api/paymob/price/route.ts
app/(dashboard)/subscribe/page.tsx
.gitignore
```

---

## ٤. الميزات — وصف مختصر لكل واحدة

**١. حسابات كاشير منفصلة بدخول برقم سري**
كل موظف له حساب باسمه بإيميل داخلي (`اسم@كود-المحل.octopus.local`).
الدخول ٣ خطوات: كود المحل ← دوس على اسمك ← رقم سري. من غير كتابة إيميل.

**٢. سجل الفواتير المفتوحة (مضاد السرقة)**
أي فاتورة اتفتحت واتقفلت من غير بيع بتتسجّل بالاسم والدقيقة والمبلغ في
جدول append-only. مفيش صلاحية تعديل ولا حذف لأي حساب.

**٣. ٣ تسعيرات لكل صنف**
أسماء التسعيرات قابلة للتعديل من صاحب المحل.

**٤. فصل الطباعة عن البيع**
كل بيعة بتطبع إجباريًا (اختياري)، وفيه طباعة عرض سعر من غير بيع.

**٥. فاتورة إنجليزي** للتسعيرة الأعلى (للسياح).

**٦. حساب العملاء المؤجل**
الزبون ياخد على الحساب ويتحاسب آخر اليوم. الأرصدة **محسوبة مش مخزّنة**.

**٧. استيراد كتالوج من إكسل**
قارئ XLSX من غير أي مكتبة خارجية (`DecompressionStream`).

**٨. قوالب أنواع الأنشطة**
١١ نوع نشاط، كل واحد بيفتح بميزاته وفئاته وكلماته. قابلة للتعديل من Master.

**٩. أدوار الموظفين**
كاشير / أمين مخزن / مدير، + صلاحيات إضافية فردية. **متفروضة في القاعدة**
عن طريق `has_permission()` مش بإخفاء أزرار.

**١٠. طلبات التعديل**
تفعيل ميزة، تغيير نوع النشاط، إضافة مخزن أو فرع — كلها **مستحيلة** على
صاحب النشاط ولازم تعدّي على الإدارة.

**١١. التنبيهات**
جرس بعدّاد + صفحة. بتيجي عند: صنف قرب يخلص، فاتورة اتفتحت وماتنفذتش،
طلب جديد، رد على طلب، تنفيذ أمر من المساعد.

**١٢. المساعد الذكي بينفّذ أوامر**
بيحوّل جملة عربية لأمر، بيعرض اقتراح مكتوب، **وما ينفّذش غير بعد الموافقة**.
بينفّذ: سعر صنف، أسعار فئة، إضافة صنف/فئة، حد أدنى للمخزون.
مرفوض: موظفين، صلاحيات، ميزات، اشتراكات، أي حذف.

**١٣. تخصيص الواجهة لكل بزنس**
معاينة حية لشاشة أي موظف، كلمات المحل نفسه (أصناف/أكلات/قطع...)،
تطبيق قالب على محل شغّال، وحفظ إعداد محل كقالب جديد.

**١٤. نظام الإحالة**
كود التسجيل هو كود الإحالة. **المكافأة ما بتبدأش غير بعد أول دفعة حقيقية**
وبتستمر ١٢ شهر (٢٠٠ ج/شهر = ٢٤٠٠ للمحل الواحد). صاحب المحل بياخدها
خصم على فاتورته، والمسوّق بياخدها كاش.

**١٥. التسعير لكل قايمة**
مفيش باقات. `الفاتورة = الأساسي + القوايم المفتوحة + المقاعد الزيادة`.
كل الأسعار قابلة للتعديل من Master. سعر خاص لأي محل = حقل واحد.

**١٦. الفاتورة والدفع متطابقين**
سعر الاشتراك بيتحسب على السيرفر من نفس الدوال اللي الشاشة بتستعملها
(`lib/monthlyDue.ts`)، فالمبلغ اللي بيتشال في Paymob هو نفسه اللي
صاحب المحل شافه. **المبلغ عمره ما بيتاخد من المتصفح.**

**١٧. تصدير البيانات**
أصناف / مبيعات سنة / عملاء — ملفات CSV بتفتح في إكسل بعربي سليم.

**١٨. تشديد أمني**
راجع القسم اللي تحت.

---

## ٥. الأمان — أهم جزء في التسليم

### ٤ ثغرات حقيقية اتلقت واتصلحت (ميجريشن 044)

كلها نفس النمط: `business_isolation FOR ALL` بتدي أي عضو في البزنس
صلاحية INSERT/UPDATE/DELETE. اتثبتت **باختبارات اختراق حقيقية على بيانات حية**:

1. الكاشير كان يقدر **يمسح فاتورة** — ده بيلغي نظام مضاد السرقة كله
2. الكاشير كان يقدر يمسح مصروفات
3. الكاشير كان يقدر يعيد كتابة أسعار الأصناف
4. الكاشير كان يقدر يعدّل بيانات البزنس نفسه

### الكاشير مبقاش يكتب في المخزون (ميجريشن 053)

البيع كان بيسحب FIFO **من المتصفح**، فكل كاشير كان محتاج صلاحية UPDATE
على `stock_batches` و `items`. اتنقل لدالة `draw_stock_fifo` بـ`FOR UPDATE`.
ده كمان صلّح **مشكلة تسابق**: كاشيرين بيبيعوا آخر قطعة في نفس اللحظة.

### نتيجة المسح الشامل

محاولة تعديل وحذف في **كل جدول** بحساب كاشير حقيقي:

```
CASHIER WRITE SWEEP >> NOTHING WRITABLE
```

قايمة كل اللي الكاشير يقدر يكتبه دلوقتي: فواتير، أصناف الفاتورة،
مصروفات، زباين، دفعات زباين، سجل الفواتير، فتح شيفت. مفيش غير كده.

### القاعدة الحاكمة

> أي فيتشر جديد للصلاحيات لازم يتفرض في الـAPI/قاعدة البيانات،
> **مش بإخفاء أزرار في الواجهة.**

---

## ٦. حالة البيانات

اتعمل تصفير: **اتمسح ٤ بيزنسات تجريبية فاضية** و**حسابين تسجيل ناقصين**،
وكل سجلات التجارب (إجراءات Master، التنبيهات، أوامر المساعد، الطلبات).

**الموجود دلوقتي:** ٥ بيزنسات، ٩ مستخدمين، ١١ قالب نشاط، ١١ سعر قايمة،
وإعدادات تسعير واحدة. صلاحية Master على `basildraz@gmail.com` اتأكدت.

---

## ٧. اللي لسه ناقص أو محتاج اختبار

### محتاج اختبار على السيرفر (أولوية عالية)
- [ ] **بيعة حقيقية لصنف عنده مخزون، والتأكد إن الكمية نقصت.** ده أهم
      اختبار — قاعدة البيانات اتغيرت كتير والكود لسه ما اتجربش عليها في الإنتاج.
- [ ] دخول كاشير بالرقم السري على الموقع المنشور
- [ ] المساعد الذكي — لو رمى خطأ، شوف اسم الموديل في `lib/gemini.ts`
      (`gemini-3.5-flash-lite` — ما اتأكدناش إنه صحيح)
- [ ] تصدير البيانات — التأكد إن العربي بيفتح صح في إكسل

### ملفات ميتة محتاجة تتمسح
- `types/plan.ts` — بيشاور على جدول `plans` اللي اتمسح في 062
- `repositories/plan.repository.ts` — نفس السبب
- `app/(dashboard)/sales/` — فولدر فاضي (شاشة البيع في `app/(pos)/sales/`)

### مشاكل معروفة
- **إعداد ESLint مكسور** (من قبل شغلنا): `eslint.config.mjs` بيستورد
  `eslint-config-next/core-web-vitals` من غير `.js`. ما بيوقّفش البناء
  بس بيمنع الـlinting. الحل: زوّد `.js`.
- **Vercel مش مربوط بـGitHub** — النشر يدوي بـ`npx vercel --prod`.
- **Leaked password protection** في Supabase محتاج خطة Pro.

### شغل مطلوب لسه
- [ ] **التجديد التلقائي** — المبلغ بقى صح ومربوط بالفاتورة المحسوبة،
      بس التجديد الشهري نفسه لسه يدوي (مفيش خصم تلقائي متكرر).
- [ ] **إضافة الموظفين لسه بتعدّي على الإدارة** — الحدود بتتفرض فوقها.
      عند ٢٠ محل+ ده هيبقى عنق زجاجة ويستحسن يعدّي تلقائي جوه الحد.
- [ ] **إشعارات الموبايل** — التنبيهات جوه البرنامج بس (مفيش واتساب/Push).
- [ ] **كتيّب المسوّقين** — اتفق عليه وما اتعملش.
- [ ] **تشغيل أول عميل حقيقي (كيرو)** — تسجيل بإيميله، استيراد ملف
      المشروبات، تحديد أرقام سرية للكاشيرين.

---

## ٨. مفاتيح البيئة

الكود بيستعمل ١١ مفتاح. كلهم متسجّلين على Vercel في Production:

```
NEXT_PUBLIC_SUPABASE_URL              SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  GEMINI_API_KEY
SIGNUP_INVITE_CODE                    SUBSCRIPTION_PRICE_EGP
PAYMOB_PUBLIC_KEY                     PAYMOB_SECRET_KEY
PAYMOB_HMAC_SECRET                    PAYMOB_INTEGRATION_ID
ASSISTANT_GEMINI_DAILY_LIMIT (اختياري، الافتراضي ٥٠)
```

**`SUPABASE_SERVICE_ROLE_KEY` هو أخطرهم** — كل صفحات Master ودخول
الكاشير بيمروا عليه.

---

## ٩. قواعد المشروع (من `docs/OCTOPUS_CORE.md` و `ARCHITECTURE.md`)

اللي هيكمّل لازم يقراهم — التسعير اتعاد بناؤه مرة عشان أول نسخة خالفتهم:

- **نوع النشاط بيغيّر التجربة بس، ما بيحدّش الإمكانيات أبدًا**
- **ما تبنيش لبزنس واحد. ابني لكل بزنس**
- **كل فيتشر معزول**
- **مفيش إعدادات مكتوبة في الكود — أي قيمة قابلة للتعديل لازم يكون ليها شاشة**
- **الواجهة ما بتكلمش Supabase مباشرة**
- **الموبايل أولًا**
