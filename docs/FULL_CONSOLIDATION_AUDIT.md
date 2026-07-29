# 🐙 Octopus — Full Repository Comparison & Consolidation Audit (Phase 2)

**تاريخ المراجعة:** 2026-07-29
**النطاق:** مقارنة كاملة بين `octopus` (V1) و `octopus-v2` (V2) على مستوى الملفات والتوثيق فقط.
**لا تعديل:** لم يتم تعديل أو حذف أو إنشاء أي ملف كود في أي من المشروعين أثناء هذه المراجعة. هذا الملف هو الناتج الوحيد.
**ملاحظة منهجية:** لم أفترض أن `Item` صحيح فقط لأن تقرير Phase 1 اقترحه. تم التأكد من ذلك بشكل مستقل من توثيق V2 نفسه (`docs/DOMAIN.md` و `docs/ARCHITECTURE.md`) واللي كُتب قبل أي تقرير مني — V2 بيمنع صراحةً استخدام كلمة "Product" كجدول أو مفهوم منفصل.

---

## 1. Current State of V1 (`octopus`)

- **Stack:** Next.js 15.5.20, React 19.2.4, zod 3.25.76, بدون zustand/recharts/sonner.
- **البنية:** `app/`, `components/`, `repositories/`, `services/` (شبه مهجورة)، `features/` (ملف فاضي)، `types/` (مسطحة، كل نوع في ملف منفصل)، `data/` (بيانات ثابتة)، `database/migrations/`.
- **التوثيق:** 4 ملفات فقط (`ARCHITECTURE.md`, `DATABASE.md`, `OCTOPUS_CORE.md`, `PROJECT_ROADMAP.md`) — عالي المستوى، لا يوجد ADRs ولا توثيق لكل موديول على حدة.
- **قاعدة البيانات:** 5 migrations فعلية تغطي فقط `businesses`, `branches`, `users`, `roles`, `role_permissions`. **لا يوجد** جدول `items` ولا `categories` ولا `sales` رغم أن الكود بيفترض وجودهم.
- **الأصناف (Item):** 4 تعريفات متضاربة (`types/item.ts`, `types/product.ts`, `services/product.service.ts`, `data/products.ts`) — تفاصيلها موجودة في تقرير Phase 1 (`AUDIT_REPORT.md`).
- **المصادقة (Auth):** لا يوجد أي كود مصادقة فعلي. صفحات `login`, `login/owner` واجهات فقط (UI mockup)، مفيش `onClick` أو استدعاء Supabase Auth. جدول `users` فيه `password_hash` (نية استخدام مصادقة مخصصة) لكن مفيش كود بيستخدمه.
- **صفحة المبيعات (Sales):** شغالة بالكامل على بيانات وهمية (`data/products.ts`) — غير متصلة بـ Supabase إطلاقًا.
- **صفحة الأصناف (Items):** متصلة فعليًا بـ Supabase (`getItems`) لكن صفحة الإضافة (`items/new`) بها خطأ تجميع حقيقي (`createProduct` غير موجودة).
- **الواجهة (Dashboard Shell):** شغالة فعليًا — `DesktopSidebar`, `MobileSidebar`, `AppHeader` منفذين ومربوطين في `(dashboard)/layout.tsx`.
- **Setup Wizard:** الهيكل العام (progress bar + تنقل بين 5 خطوات) شغال، لكن **كل الخطوات الخمس فاضية** (`<div>Business Step</div>` إلخ) — لا فورم ولا state حقيقي.
- **كود ميت:** `components/items/ItemForm.tsx` + `ItemDialog.tsx` (نسخة قديمة غير مستخدمة)، `SalePopup.tsx` في الـ root (نسخة مكررة)، `types/cart.ts` (غير مستخدم).
- **أخطاء:** `tsc --noEmit` بيدي 3 أخطاء حقيقية. `npm run lint` مكسور بالكامل (مشكلة إعداد ESM في `eslint.config.mjs`).
- **Git:** المجلد مش git repository حاليًا.

---

## 2. Current State of V2 (`octopus-v2`)

- **Stack:** Next.js 16.2.10 (أحدث من V1)، React 19.2.4، zod ^4.4.3 (نسخة رئيسية أحدث)، بالإضافة إلى zustand، recharts، sonner، next-themes — متوافق مع رؤية `docs/STACK.md`.
- **البنية:** `modules/` (Feature-Based: `auth`, `business`, `customers`, `inventory`, `layout`) + `types/` مشترك (`common`, `business`, `users`) + `lib/core` (فاضي بالكامل) + `lib/supabase` (client نظيف).
- **التوثيق:** غني جدًا مقارنة بـ V1 — `ARCHITECTURE.md`, `DOMAIN.md` (يعتبر نفسه "الدستور" الرسمي للمشروع)، `FEATURES.md`, `PRODUCT_SPEC.md`, `STACK.md`, `authentication.md`, `docs/database/{core,inventory,sales}.md`, 3 ADRs في `docs/decisions/`, خطة migrations كاملة في `docs/roadmap/00-database-plan.md`. **لكن** عدة ملفات فيها فاضية تمامًا: `business-types.md`, `docs/database/customers.md`, وكل ملفات `docs/roadmap/03` إلى `06`.
- **قاعدة البيانات:** migration واحدة فقط موجودة فعليًا (`0001_core.sql`) رغم إن الخطة الموثقة بتصل لـ `0052`. لكن الـ migration دي **أكثر اكتمالًا من كل V1** بخصوص الأصناف: بتنشئ `businesses`, `users`, `categories`, **و`items`** بحقول تجارية حقيقية (`item_type`, `sku`, `barcode` unique، `purchase_price`, `selling_price`, `cost_price`, `tax_percentage`, `stock_quantity`, `minimum_stock`, `unit`, `track_inventory`).
- **لكن:** V2 مفيهوش `branches` ولا `roles` ولا `role_permissions` ولا `capabilities` — رغم إن الكود والتوثيق بيفترضوا وجودهم.
- **الأصناف (Item):** الجدول موجود في الداتابيز، لكن `modules/inventory/types/item.ts` **فاضي تمامًا** — مفيش تعريف TypeScript لـ Item في الكود أصلًا. الرؤية موثقة فقط (`DOMAIN.md` صريح: "لا يوجد Product Table مستقلة. كل شيء هو Item.") لكن التنفيذ لسه ما بدأش.
- **تضارب داخلي في V2 نفسه:** فيه **تعريفين مختلفين لـ Business**:
  - `types/business/business.ts` → `business_type`, `owner_name` إلزامي، شكل قريب من V1.
  - `modules/business/types/business.ts` → `template`, `capabilities: BusinessCapabilities`، بدون `business_type` ولا `owner_name`.
  وده نفس نمط مشكلة Item/Product في V1، بس هنا حصلت مع Business بدل Item.
- **تضارب تسمية إضافي:** حقل "نوع النشاط" له 3 أسماء مختلفة عبر V2: `type` (عمود الداتابيز + `BusinessForm` zod schema)، `template` (`Wizard`/`CreateBusinessDto`)، `business_type` (`types/business/business.ts`).
- **المصادقة (Auth):** `modules/auth` بيستخدم Supabase Auth الحقيقي فعليًا (`signInWithPassword`, `signOut`, `getUser`) — أكثر جدية من V1. لكن جدول `users` في الـ migration لسه فيه عمود `password_hash` (بقايا نهج قديم) وما فيهوش `auth_user_id` لربط المستخدم بـ Supabase Auth رغم إن `docs/database/core.md` بيوصفه.
- **Business Repository/Service:** موجودين فعليًا كـ classes (`BusinessRepository`, `BusinessService`) وبيتبعوا فعليًا البنية الموثقة (UI → Service → Repository → Supabase) — أول تطبيق حقيقي شفته للـ Layered Architecture الموثقة في أي من المشروعين. لكن `businessRepository.create` بيحاول يحفظ عمود `capabilities` مش موجود في جدول `businesses` الفعلي — يعني الكود هيفشل وقت التشغيل الحقيقي (drift بين الكود والـ migration، بنفس منطق مشكلة V1).
- **Setup Wizard:** `Wizard.tsx` بيمرر state حقيقي (`SetupData`) بين الخطوات. `Step1Business` (اسم النشاط + اختيار Template) و `Step2Template` (تفعيل/تعطيل Capabilities) شغالين فعليًا بمنطق حقيقي. `Step3Capabilities`, `Step4Settings`, `Step5Review` لسه placeholders (`<div>Step 3</div>` إلخ) — و`Step5Review` مبيستدعيش `businessService.create` أصلًا، يعني الـ wizard كله لسه مش بيحفظ حاجة.
- **كود ميت:** `modules/business/components/BusinessForm.tsx` — فورم تالت منفصل لإنشاء Business (react-hook-form + zod، بحقل `type` مش `template`)، مش مستخدم في `Wizard.tsx` أصلًا — نفس نمط "نسختين من الفورم" اللي في V1.
- **الواجهة (Dashboard Shell):** أقل اكتمالًا من V1 — `(dashboard)/layout.tsx` مجرد `<>{children}</>` بدون أي شيء. كل مكونات `modules/layout/components/*` (`Sidebar`, `Header`, `Navigation`, `Logo`, `UserMenu`) **فاضية تمامًا**.
- **صفحات مفقودة بالكامل:** لا يوجد `/login`, `/items`, `/sales` في `app/` إطلاقًا. الصفحات الموجودة فقط: `app/page.tsx` (لاندنج ثابتة، زرار "ابدأ الآن" بدون `onClick`)، `app/setup/page.tsx`، و `(dashboard)/layout.tsx` الفاضي.
- **`lib/core/{errors,result,constants}.ts`:** كلهم فاضيين — طبقة معمارية موثقة النية لكن مش منفذة.
- **Git:** لم أفحص حالة git لـ V2 بشكل منفصل؛ لم يُطلب تشغيل أوامر تنفيذية (tsc/lint) على V2 في هذه المرحلة، اكتفيت بالمراجعة الساكنة (static read) حسب تعليماتك.

---

## 3. Feature Comparison Matrix

| الميزة / الوحدة | V1 | V2 | الأفضل حاليًا |
|---|---|---|---|
| Businesses (type/DB) | ✅ Type + ✅ Migration | ✅ Type (×2 متضاربين) + ✅ Migration | تعادل — V1 أبسط واتساقًا، V2 أغنى لكن متضارب |
| Branches | ✅ Type + ✅ Migration، ❌ لا UI | ❌ غير موجود إطلاقًا | **V1** |
| Users | ✅ Type + ✅ Migration | ✅ Type + ✅ Migration | تعادل تقريبًا |
| Roles / Permissions | ✅ Type + ✅ Migration، ❌ لا UI | ✅ Type فقط، ❌ لا Migration | **V1** (له DB فعلي) |
| Business Capabilities | ❌ غير موجود | ✅ موثق (ADR-002) + Type + UI جزئي، ❌ لا عمود DB فعلي | **V2** (مفهوميًا) لكن غير متصل |
| Categories | ⚠️ Repository موجود، ❌ لا Migration | ✅ Migration فعلي، ❌ لا Type/Repository | **V2** (DB) لكن ولا مشروع عنده الاتنين مع بعض |
| Item / Product / Service | ⚠️ 4 تعريفات متضاربة + Repository شغال + Migration غير موجودة | ✅ Migration غنية وواقعية، ❌ Type فاضي تمامًا، ❌ لا Repository | **V2 على مستوى DB**، **V1 على مستوى وجود كود شغال (جزئيًا)** |
| Authentication | ❌ UI فقط، بدون منطق | ✅ Supabase Auth حقيقي (signIn/signOut/getUser) | **V2** بوضوح |
| Setup Wizard | ⚠️ هيكل شغال + 5 خطوات فاضية | ⚠️ هيكل + state حقيقي + خطوتين شغالتين من 5 | **V2** (أكثر تقدمًا لكن غير مكتمل) |
| Dashboard Shell (Sidebar/Header) | ✅ شغال بالكامل | ❌ فاضي بالكامل | **V1** بوضوح |
| Sales / POS | ⚠️ شغال لكن على بيانات وهمية 100% | ❌ غير موجود إطلاقًا | **V1** (ولو ضعيف) |
| Cart | ⚠️ شغال محليًا (state فقط) على بيانات وهمية | ❌ غير موجود | **V1** |
| Inventory Movements | ❌ غير موجود (فقط في docs) | ❌ غير موجود (فقط في docs) | لا أحد |
| Customers / Suppliers | ❌ غير موجود | ⚠️ Type فاضي فقط | لا أحد فعليًا |
| Purchases / Expenses / Cashbox | ❌ غير موجود | ❌ غير موجود | لا أحد |
| Repository/Service Layer الفعلي | ❌ موثق لكن غير مطبق (Features فاضية) | ✅ مطبق فعليًا لموديول Business فقط (class-based) | **V2** كنمط معماري مُثبت |
| UI Components (shadcn) | ✅ مجموعة كاملة + `checkbox`, `FormField` | ✅ نفس المجموعة تقريبًا + `dropdown-menu` إضافي | تعادل |
| التوثيق (docs) | ⚠️ 4 ملفات عامة | ✅ غني جدًا (ADRs, roadmap مقسم, domain constitution) لكن فيه ملفات فاضية كتير | **V2** بوضوح |
| Git / Version Control | ❌ لا يوجد | لم يُفحص هذه المرة | غير محسوم |

---

## 4. Architecture Comparison

| البند | V1 | V2 |
|---|---|---|
| نمط التنظيم | مسطح: `repositories/`, `services/`, `features/`, `types/` منفصلين على مستوى الجذر | Feature-Based: `modules/<feature>/{components,hooks,repositories,services,types,validation}` |
| هل الطبقات المذكورة في التوثيق مطبقة فعليًا؟ | لا — الصفحات تنادي `repositories/` مباشرة | جزئيًا — موديول `business` فقط بيتبع الطبقات فعليًا (Service class ينادي Repository class) |
| قاعدة تسمية الكيانات | غير موثقة صراحة، لكن الكود اتلخبط (Item/Product) | موثقة صراحة وبشكل قاطع: "Item ✅ ... Never use: Product" |
| Multi-Business / Multi-Tenant | مذكور ضمنيًا (`business_id` في كل جدول) | موثق رسميًا كـ ADR (001) — Multi-Tenant + RLS، لكن RLS غير منفذ في الـ migration الفعلية |
| Business Type Handling | Enum ثابت (`BusinessType`) فقط | نظامين متوازيين غير متصلين: Template (تصنيف) + Capabilities (أعلام تفعيل مرنة) — الفكرة أقوى من V1 لكن التنفيذ غير مكتمل ومتضارب داخليًا |
| Plugin System | غير موجود | موثق كمفهوم ("Core never knows Restaurant... Core only knows Plugins") لكن بدون أي كود |

**خلاصة:** رؤية V2 المعمارية أنضج ومكتوبة بوضوح أكبر، ونمط `modules/` أقرب للتوثيق الرسمي لكلا المشروعين. لكن V1 عنده أجزاء *شغالة فعليًا* (Sidebar/Header، صفحة أصناف متصلة بالداتابيز) أكتر من V2 اللي معظمه لسه هياكل فاضية خلف توثيق قوي.

---

## 5. Database Comparison

| الجدول | V1 (`database/migrations`) | V2 (`database/0001_core.sql`) |
|---|---|---|
| `businesses` | ✅ (`business_type`, `active`, `trial_end`, `currency`, `language`, `timezone`) | ✅ (`type`, `is_active` — بدون `trial_end`) |
| `branches` | ✅ كامل | ❌ غير موجود |
| `users` | ✅ (`password_hash`, `role` text، `branch_id`) | ✅ (`password_hash`، بدون `branch_id` أو `auth_user_id`) |
| `roles` | ✅ | ❌ غير موجود |
| `role_permissions` | ✅ | ❌ غير موجود |
| `categories` | ❌ (فقط Repository بدون Migration) | ✅ (`parent`-ready عبر `sort_order`, `color`, `icon`) |
| `items` | ❌ (فقط Repository بدون Migration) | ✅ غني: `item_type`, `sku`, `barcode` (unique)، `purchase_price`, `selling_price`, `cost_price`, `tax_percentage`, `stock_quantity`, `minimum_stock`, `unit`, `track_inventory` |
| `business_capabilities` | ❌ | ❌ (موثق في ADR-002 لكن غير مُنشأ، والكود بيفترض عمود `capabilities` مش موجود) |
| `sales` / `sale_items` / `payments` | ❌ (موثق فقط) | ❌ (موثق فقط في `docs/database/sales.md`) |
| RLS | غير مذكور | موثق (ADR-001) لكن غير منفذ في SQL الفعلي |

**ملاحظات تسمية مهمة (Naming Drift) بين المشروعين:**
- V1 يستخدم `active` بينما V2 يستخدم `is_active` لنفس الغرض.
- V1 يستخدم `business_type` بينما V2 يستخدم `type` (في الـ DB) و`template` (في الكود) لنفس الغرض تقريبًا.
- V1 عمود واحد `unit?: string`، وV2 عمود واحد `unit text default 'piece'` في جدول `items` — **كلاهما لا يطابق** رؤية `docs/DATABASE.md` (V1) أو `docs/database/inventory.md` (V2) اللي بتوصف نظام وحدات متعدد (`ItemUnit` / `Item Units` جدول منفصل بيربط Item بأكتر من وحدة). يعني التنفيذ الفعلي في الاتنين أبسط من التوثيق.

---

## 6. Item / Product / Service Model Comparison

| المصدر | الحالة |
|---|---|
| V1 `types/item.ts` | تعريف غني (`sale_methods[]`, `units: ItemUnit[]`) لكن غير متصل بأي migration حقيقية |
| V1 `types/product.ts`, `services/product.service.ts`, `data/products.ts` | نسخ متضاربة/وهمية — يجب التخلص منها (تفاصيل كاملة في `AUDIT_REPORT.md`) |
| V2 `docs/DOMAIN.md` + `docs/ARCHITECTURE.md` | **الحكم الأوضح في المشروعين مجتمعين**: "لا يوجد Product Table مستقلة. كل شيء هو Item" + "Never use: Product" بشكل صريح ورسمي |
| V2 `database/0001_core.sql` → `items` | أفضل تعريف DB فعلي لـ Item موجود في أي من المشروعين — لكن بدون أي TypeScript type مقابل |
| V2 `modules/inventory/types/item.ts` | **فاضي تمامًا** — الرؤية موثقة، الجدول موجود، لكن الكود التطبيقي غير موجود |

**الخلاصة الحاسمة:** لا يوجد أي مصدر — لا في V1 ولا في V2 ولا في التوثيق — يدعم وجود `Product` ككيان منفصل عن `Item`. القرار في تقرير Phase 1 بمعاملة `Item` كالكيان الموحّد الوحيد (مع `item_type` لتحديد `product` أو `service`) **مؤكد بشكل مستقل بواسطة V2**، وليس افتراضًا من تقريري السابق فقط. أفضل نقطة بداية عملية هي: بنية V2 لجدول `items` + غنى تعريف V1 لـ `types/item.ts` (خصوصًا `sale_methods[]` و `units[]`) مدموجين مع بعض.

---

## 7. Authentication and Authorization Comparison

| البند | V1 | V2 |
|---|---|---|
| آلية المصادقة | لا يوجد كود فعلي؛ عمود `password_hash` موجود بدون استخدام | Supabase Auth حقيقي (`signInWithPassword`, `signOut`, `getUser`) |
| ربط المستخدم بـ Supabase Auth | غير منطبق (لا يوجد Supabase Auth) | غير مكتمل — لا يوجد عمود `auth_user_id` في جدول `users` رغم استخدام Supabase Auth فعليًا |
| الأدوار (Roles) | جدول DB فعلي + `role text` في `users` | `RoleType` union فقط (`owner\|manager\|cashier\|employee`) بدون جدول DB |
| الصلاحيات (Permissions) | `types/permission.ts` + `types/role.ts` (تعريفين مختلفين شكليًا لنفس الفكرة) + جدول DB فعلي `role_permissions` | `types/users/permission.ts` (شكل قريب من V1) + جدول `role_id/permission_key` في `docs/database/core.md` فقط، بدون migration |
| صفحات تسجيل الدخول | موجودة (owner/employee) لكن واجهة فقط بدون منطق | غير موجودة إطلاقًا في `app/` |
| Session/Middleware/Protected Routes | غير موجود | موثق في `docs/authentication.md` كخطة، غير منفذ |

**التقييم:** V2 متقدم فعليًا في اختيار آلية المصادقة الصحيحة (Supabase Auth بدل تخزين باسورد مخصص) لكنه غير مكتمل التوصيل بقاعدة البيانات. V1 عنده تصميم صلاحيات (Roles/Permissions) أوضح على مستوى DB لكن بدون أي مصادقة حقيقية تربط بيه. **لازم دمج الاتنين:** اعتماد Supabase Auth (منهج V2) + جدول `roles`/`role_permissions` الفعلي (منهج V1) + عمود `auth_user_id` مفقود من الاتنين.

---

## 8. What to Keep from V1

- `database/migrations/002_branches.sql`, `004_roles.sql`, `005_role_permissions.sql` — جداول حقيقية V2 مفتقدها بالكامل.
- `components/layout/{DesktopSidebar,MobileSidebar,AppHeader}.tsx` — واجهة Dashboard شغالة فعليًا، أفضل من V2 الفاضي.
- `repositories/item.repository.ts` — نمط دوال بسيط شغال فعليًا مع Supabase (بعد تصحيح اسم الدالة وربطه بجدول Items حقيقي).
- `types/item.ts` — أغنى تعريف Item موجود من ناحية TypeScript (`sale_methods[]`, `units: ItemUnit[]`) رغم عدم اتصاله بـ DB حاليًا.
- فكرة `app/(dashboard)/items` كصفحة متصلة فعليًا بـ Supabase — دليل عملي إن النمط شغال.

## 9. What to Keep from V2

- `docs/DOMAIN.md` و `docs/ARCHITECTURE.md` — أفضل توثيق حوكمة/تسمية موجود؛ يجب اعتمادهما كمرجع أعلى سلطة بدل نسخ V1 المتضاربة معهما.
- `database/0001_core.sql` (جدول `items` و`categories`) — أفضل بداية DB فعلية للأصناف موجودة في أي من المشروعين.
- `modules/auth/*` — نمط مصادقة حقيقي (Supabase Auth) يجب اعتماده بدل فكرة `password_hash` في V1.
- فكرة `BusinessCapabilities` (ADR-002) — مرونة تفعيل/تعطيل الموديولات per-business بدل الاعتماد فقط على enum ثابت.
- نمط `modules/business/{repository,service}.ts` كـ classes — أول تطبيق فعلي شفته للـ Layered Architecture الموثقة في كلا المشروعين؛ يصلح كقالب لباقي الموديولات.
- بنية `modules/` نفسها كتنظيم مجلدات — أقرب لما يوصفه `docs/ARCHITECTURE.md` في كلا النسختين.
- `types/common/base.ts` (`BaseEntity`, `Activatable`, `BusinessOwned`, `BranchOwned`) — أنماط مشتركة نظيفة تقلل التكرار، V1 ما عندهوش حاجة زيها.
- إضافات الـ Stack: `zustand`, `sonner`, `next-themes`, `recharts` — مفيدة لمراحل قادمة (State, Notifications, Reports).

## 10. What to Discard

**من V1** (تفاصيلها في `AUDIT_REPORT.md`):
- `types/product.ts`, `services/product.service.ts`, `data/products.ts`
- `components/items/ItemForm.tsx` + `components/items/ItemDialog.tsx` (كود ميت)
- `SalePopup.tsx` في الـ root (نسخة مكررة)
- `types/cart.ts` (غير مستخدم)

**من V2:**
- `modules/business/components/BusinessForm.tsx` — فورم مكرر غير مستخدم في `Wizard.tsx`، بنفس منطق مشكلة V1.
- واحد من تعريفي `Business` (يُقرر لاحقًا أيهما يُدمج داخل الآخر — ليس حذف فوري، بل توحيد عند التنفيذ).

**ملاحظة:** هذا القسم توصيف لما يجب مناقشته عند التنفيذ فقط — **لم يُحذف أي ملف فعليًا في هذه المرحلة.**

## 11. What is Missing (في كلا المشروعين)

- Sales / POS متصل بقاعدة بيانات حقيقية (V1 وهمي بالكامل، V2 غير موجود).
- Cart مبني على `Item` الحقيقي بدل بيانات ثابتة.
- Inventory Movements، Purchases، Suppliers، Customers، Expenses، Cashbox — موثقين فقط في كلا المشروعين، بدون أي كود.
- RLS Policies فعلية على مستوى SQL.
- عمود `auth_user_id` لربط `users` بـ Supabase Auth.
- جدول/عمود `business_capabilities` فعلي في قاعدة البيانات (V2 موثقه ويفترضه الكود، لكنه غير منشأ).
- نظام وحدات متعدد فعلي (`ItemUnit`/`Item Units`) — موثق في كلا المشروعين، غير منفذ في أي منهما.

## 12. Conflicts and Risks

1. **لا يوجد تعارض حقيقي حول Item مقابل Product** — كلا المشروعين (ضمنيًا V1 عبر `OCTOPUS_CORE.md`، وصراحة V2 عبر `DOMAIN.md`) يدعمان "Item موحّد". القرار مؤكد، وليس نقطة خلاف.
2. **تعارض تسمية Business Type:** 3 أسماء مختلفة لنفس الحقل عبر V2 وحده (`type`, `template`, `business_type`) بالإضافة لتصميم V1 الرابع (`business_type` enum ثابت). يجب حسم اسم وشكل واحد قبل أي migration جديدة.
3. **تعارض استراتيجية المصادقة:** V1 مصمم (جزئيًا) حول `password_hash` بدون تنفيذ. V2 ينفذ Supabase Auth فعليًا لكن بيحتفظ بعمود `password_hash` كبقايا ومن غير `auth_user_id`. الاستمرار من غير حسم هيؤدي لازدواجية مصادر حقيقة لهوية المستخدم.
4. **Drift بين الكود والـ DB في V2 نفسه:** `businessRepository.create()` بيحاول يحفظ `capabilities` في جدول `businesses` رغم إن العمود غير موجود في `0001_core.sql` — هيفشل وقت التشغيل الفعلي، بنفس طبيعة مشكلة V1 مع جدول `items`/`products` غير الموجود.
5. **نمط متكرر من "نسختين من نفس الفورم/النوع":** حصل في V1 (ItemForm ×2) وفي V2 (Business type ×2, Business form ×2) بشكل مستقل. ده مش خطأ عابر، ده نمط عمل (working habit) يستاهل انتباه أثناء الدمج: كل مرة نبني كومبوننت جديد، لازم نتأكد نحذف/نربط القديم في نفس الجلسة.
6. **لا يوجد Git** في V1 (تأكدت من بيئة التشغيل: `Is a git repository: false`). قبل أي دمج فعلي، غياب أي شبكة أمان (commits/branches) يخلي أي تعديل لاحق خطر بدون وسيلة تراجع سهلة.

---

## 13. Recommended Canonical Architecture

اعتماد بنية `modules/` (من V2) كهيكل رسمي نهائي، لأنها أقرب لما يوصفه توثيق كلا المشروعين، مع تطبيق الطبقات فعليًا (مش بس توثيقها) في كل موديول:

```
Presentation (app/ + modules/*/components)
      ↓
Hooks (modules/*/hooks)
      ↓
Services (modules/*/services)      ← منطق العمل، Validation
      ↓
Repositories (modules/*/repositories) ← Supabase فقط، بدون منطق عمل
      ↓
Supabase
```

قواعد ثابتة (مُجمّعة من `docs/ARCHITECTURE.md` في كلا المشروعين):
- الـ Component لا ينادي Supabase مباشرة أبدًا.
- كل كيان قابل للبيع = `Item`، ويُفرَّق بواسطة `item_type` فقط (`product` | `service`) — ممنوع أي "Product Table" أو "Product Type" منفصل.
- كل جدول: `business_id`, `active` (توحيد الاسم من `is_active`)، `created_at`, `updated_at`.
- Business Capabilities هي مصدر الحقيقة للميزات المفعّلة، مش `business_type` وحده.

---

## 14. Recommended Canonical Database Model

دمج أفضل ما في المشروعين + سد الفجوات:

- **businesses**: من V1 (`business_type`, `trial_end`, `currency`, `language`, `timezone`) + إضافة `capabilities` كجدول منفصل (منهج V2/ADR-002) بدل عمود JSON مباشر.
- **branches**: من V1 كما هي (V2 لا يملك بديلًا).
- **users**: دمج — أعمدة V1 (`branch_id`, `role`) + `auth_user_id` (موثق في V2، غير منفذ) — **وحذف `password_hash` نهائيًا** لصالح Supabase Auth الكامل.
- **roles** / **role_permissions**: من V1 كما هي.
- **business_capabilities**: جدول جديد فعلي (كان موثق فقط في V2 ADR-002) — `inventory_enabled`, `services_enabled`, `customers_enabled`, `appointments_enabled`, إلخ.
- **categories**: من V2 (`sort_order`, `color`, `icon`, `parent_id`).
- **items**: من V2 (الأعمدة التجارية الغنية) + دمج فكرة V1 (`sale_methods[]`) كعمود إضافي أو جدول `item_sale_methods` منفصل.
- **units** / **item_units**: جدول جديد فعلي (موثق في كلا المشروعين، غير منفذ في أي منهما) بدل عمود `unit` نصي وحيد.
- **inventory** / **inventory_movements**: جديد بالكامل حسب `docs/database/inventory.md` (V2).
- **customers**, **suppliers**: جديد بالكامل.
- **sales**, **sale_items**, **payments**: جديد بالكامل حسب `docs/database/sales.md` (V2، الأكثر تفصيلاً بين المصدرين).

---

## 15. Recommended Migration Order

1. `businesses` + `users` (مع `auth_user_id`, بدون `password_hash`)
2. `branches`
3. `roles` + `role_permissions`
4. `business_capabilities`
5. `categories`
6. `units`
7. `items`
8. `item_units`
9. `inventory` + `inventory_movements`
10. `customers` + `suppliers`
11. `sales` + `sale_items` + `payments`
12. `purchases` + `purchase_items`
13. `expenses` + `cashboxes`
14. RLS Policies (على كل جدول فور إنشائه، مش دفعة واحدة في الآخر)

---

## 16. Exact Proposed File/Folder Structure (المشروع الموحّد المستهدف)

```
octopus/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       ├── page.tsx
│   │       ├── owner/page.tsx
│   │       └── employee/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── items/
│   │   ├── sales/
│   │   ├── customers/
│   │   └── settings/
│   └── setup/
│       └── page.tsx
│
├── modules/
│   ├── auth/            (components, hooks, repositories, services, types)
│   ├── business/         (+ capabilities, wizard)
│   ├── branches/
│   ├── users/             (roles + permissions)
│   ├── inventory/        (categories, items, units, stock, movements)
│   ├── sales/              (pos, cart, sale, payments)
│   ├── customers/
│   ├── suppliers/
│   ├── purchases/
│   ├── expenses/
│   ├── reports/
│   └── ai/                 (مستقبلي)
│
├── types/
│   └── common/           (BaseEntity, Activatable, BusinessOwned, BranchOwned)
│
├── components/
│   ├── ui/                  (shadcn primitives المشتركة)
│   └── layout/            (Sidebar, Header, Navigation المشتركة عبر كل الموديولات)
│
├── lib/
│   ├── supabase/
│   └── core/                (errors, result, constants)
│
├── database/
│   └── migrations/       (الترتيب في القسم 15)
│
└── docs/
    ├── DOMAIN.md          (من V2 — الدستور المعتمد)
    ├── ARCHITECTURE.md
    ├── decisions/          (ADRs)
    ├── database/
    └── roadmap/
```

---

## 17. Safe Step-by-Step Consolidation Plan

> كل خطوة تحتاج موافقتك قبل التنفيذ الفعلي — القائمة دي ترتيب مقترح فقط.

1. **شبكة أمان أولًا:** عمل `git init` + أول commit لكل من V1 وV2 كما هما الآن (قبل أي تعديل) — حاليًا V1 مش git repo، وده لازم يتحل قبل أي خطوة تانية.
2. **اعتماد التوثيق المرجعي:** نقل/تكييف `docs/DOMAIN.md` و `docs/ARCHITECTURE.md` من V2 ليصبحا المرجع الرسمي الأعلى سلطة، وتحديث ملفات V1 (`ARCHITECTURE.md`, `DATABASE.md`, `OCTOPUS_CORE.md`) لتتوافق معهم أو تُستبدل.
3. **حسم أسماء الحقول المتضاربة** (قسم 12) قبل كتابة أي migration: `active` مش `is_active`، اسم واحد لـ business type، الخ.
4. **كتابة الـ migrations الموحدة** حسب الترتيب في القسم 15 — من الصفر، بدون نسخ أي migration قديمة حرفيًا.
5. **توحيد الأنواع (Types):** إنشاء `types/common/base.ts` أولًا (من V2)، بعدين `Item`, `Business`, `User` الموحدين، مع حذف التعريفات المكررة **فقط بعد التأكد إن الجديد بيبني بنجاح (`tsc --noEmit`)**.
6. **إعادة بناء طبقة Repository/Service موديول بموديول**، بالترتيب: `auth` → `business` → `inventory/items` → `sales`. كل موديول يتقفل (compiles + يتفحص يدويًا) قبل الانتقال للتالي.
7. **إعادة وصل الواجهات:** دمج Sidebar/Header الشغالة من V1 داخل هيكل `modules/layout` الفاضي في V2، وإكمال خطوات Setup Wizard (3-5) اعتمادًا على شكل V2 مع منطق الحفظ الفعلي (`businessService.create`).
8. **حذف الكود الميت والمكرر** (الأقسام 10) — فقط بعد التأكد إن البديل شغال، وبموافقتك في كل مرة.
9. **إعادة تشغيل `tsc --noEmit` و `npm run lint`** بعد كل موديول (مش مرة واحدة في الآخر) لضمان اكتشاف الأخطاء مبكرًا.
10. **بناء Sales/POS من الصفر** على `items` الحقيقية بعد استقرار موديول `inventory` — ده آخر خطوة لأنه أضعف جزء في كلا المشروعين.

---

*هذا التقرير للمراجعة فقط. لم يتم تعديل أو حذف أي ملف في `octopus` أو `octopus-v2` أثناء إعداده.*
