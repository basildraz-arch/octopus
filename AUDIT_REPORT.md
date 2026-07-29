# 🐙 Octopus V1 — تقرير Full Project Audit

**تاريخ المراجعة:** 2026-07-29
**النطاق:** مجلد `octopus` (V1) فقط — بدون تعديل أي كود.
**الطريقة:** قراءة التوثيق كامل (`CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/*`)، فحص كل ملفات `types/`، `repositories/`، `services/`، `features/`، فحص `database/migrations/`، تتبع كل استخدامات `Item` / `Product` / `ItemForm` عبر `app/` و `components/`، وتشغيل `npx tsc --noEmit` و `npm run lint`.

---

## 1. البنية الحالية (Current Architecture)

**التقنيات:** Next.js 15 (App Router) + React 19 + TypeScript + Supabase + Tailwind + مكونات shadcn/ui.

**البنية المفروضة حسب `docs/ARCHITECTURE.md`:**

```
UI → Features → Services → Repositories → Supabase
```

يعني الواجهة (UI) متتكلمش مع Supabase مباشرة، لازم تعدي عبر Features ثم Services ثم Repositories.

**البنية الفعلية في الكود — مش متطبقة:**

- الصفحات (مثال: `app/(dashboard)/items/page.tsx`) بتستدعي الـ repository مباشرة (`getItems` من `repositories/item.repository.ts`) — مفيش أي طبقة Service أو Feature بينهم.
- مجلد `features/products/` فيه ملف واحد اسمه `create-product.ts` وهو **فاضي تمامًا** (0 بايت). طبقة الـ Features مش موجودة فعليًا لحد دلوقتي.
- `services/product.service.ts` موجود لكن **مش مستخدم في أي مكان** في التطبيق (اتأكد بالبحث الكامل).

**الصفحات الموجودة فعليًا:**

- تسجيل دخول: `app/(auth)/login`, `app/(auth)/login/owner`
- لوحة تحكم: `app/(dashboard)/items`, `app/(dashboard)/items/new`, `app/(dashboard)/sales`
- Setup Wizard: `components/setup/*` — موجود كمكونات بس مش لسه متوصل بصفحة فعلية في `app/`.

---

## 2. تضارب Item vs Product — بالتفصيل

المشكلة أعمق من مجرد تضارب بين ملفين — فيه **4 تعريفات مختلفة** لنفس الفكرة، منتشرة في المشروع.

### التعريف 1: `types/item.ts` → `interface Item`

الأقرب لرؤية التوثيق (`docs/OCTOPUS_CORE.md` و `docs/DATABASE.md`): صنف واحد (Item) ممكن يكون `product` أو `service`, وله:

- `sale_methods: SaleMethod[]` (قطعة / وزن / مبلغ / صندوق ...)
- `units: ItemUnit[]` (وحدات متعددة مع تحويل بينها)
- `keywords: string[]` إلزامي

### التعريف 2: `types/product.ts` → `interface Item` (بردو اسمها Item رغم إن اسم الملف product.ts)

تعريف مختلف تمامًا عن رقم 1:

- مفيهاش `sale_methods` ولا `units[]`
- بدالها `unit?: string` (وحدة واحدة نص)، و `sell_by_money`, `sell_by_weight` (بوليان بدل مصفوفة)
- `keywords` اختياري مش إلزامي

⚠️ الملف اسمه `product.ts` لكن المحتوى اسمه `Item` مش `Product` — تضارب تسمية إضافي.

### التعريف 3: `services/product.service.ts` → `type Product`

تعريف تالت، بيقرا من جدول Supabase اسمه **`products`** (مختلف عن جدول `items`!):

- `barcode: string` إلزامي (مش اختياري)
- `keywords: string` (نص واحد، مش مصفوفة) — عكس كل التعريفات التانية

### التعريف 4: `data/products.ts` → `type Product` (بيانات Hardcoded)

مصفوفة منتجات ثابتة جوه الكود (Royal Canin, Whiskas ...):

- `id: number` (مش `string`/uuid زي باقي التعريفات)
- `price: number` (حقل واحد بس، مفيش `buy_price` / `sell_price`)
- ⚠️ يخالف قاعدة رقم 1 في `docs/ARCHITECTURE.md`: **"No hardcoded products"** — القاعدة نفسها موجودة في توثيق المشروع.

### أثر التضارب على الكود الفعلي (أخطاء حقيقية مش نظرية)

| الملف | بيستخدم | المشكلة |
|---|---|---|
| `components/items/form/ItemForm.tsx` | `createProduct` من `repositories/item.repository` | الدالة دي **مش موجودة أصلًا** في `item.repository.ts` (فيه بس `createItem`). خطأ تجميع حقيقي (TS2305). |
| `components/items/ItemDialog.tsx` | `ProductFormValues` من `./ItemForm` (النسخة القديمة) مع `createItem` (النوع الصح) | النوعين مش متوافقين — خطأ TS2345 لأن `ProductFormValues` ناقصها حقول زي `item_type`, `has_stock`, `active`. |
| `components/Cart.tsx`, `ProductList.tsx`, `SalePopup.tsx`, `lib/search.ts` | `Product` من `data/products.ts` (بيانات ثابتة) | صفحة المبيعات كلها شغالة على بيانات وهمية، مش متصلة بـ Supabase أو بجدول `items` الحقيقي. |
| نسختين من `ItemForm.tsx` | `components/items/ItemForm.tsx` (قديمة، اسم الكومبوننت الفعلي جواها `ProductForm`) و `components/items/form/ItemForm.tsx` (جديدة، react-hook-form + zod) | النسخة القديمة مش مستخدمة في أي صفحة فعلية (dead code) — وبتتفتح بس من `ItemDialog.tsx` اللي هو كمان مش مستخدم في أي صفحة. |
| نسختين من `SalePopup.tsx` | واحدة في الـ root (`SalePopup.tsx`) وواحدة في `components/SalePopup.tsx` | النسخة اللي في الـ root مش مستوردة من أي حتة — كود ميت متروك. |
| `types/cart.ts` (`CartItem`) | — | معرّف بس **مش مستخدم خالص** — `Cart.tsx` عامل تعريف `CartItem` تاني بنفسه محليًا. |

**خلاصة:** مش "تضارب بسيط بين ملفين" — فيه 4 تعريفات مختلفة، كود ميت في مكانين (`ItemDialog`/`ItemForm` القديم و `SalePopup.tsx` في الـ root)، ودالة (`createProduct`) بتتنادى وهي مش موجودة أصلًا، وده بيكسر التجميع فعليًا.

---

## 3. Database Findings

فحصت كل ملفات `database/migrations/` (001 لحد 005). الجداول اللي بتتعمل فعليًا:

- `businesses` (001)
- `branches` (002)
- `users` (003)
- `roles` (004)
- `role_permissions` (005)

### ⚠️ اكتشاف مهم

**مفيش أي migration بتعمل جدول `items` ولا `products` ولا `categories`** — رغم إن:

- `repositories/item.repository.ts` بيقرا/يكتب في جدول اسمه `items`
- `services/product.service.ts` بيقرا من جدول اسمه `products` (جدول تاني تمامًا)
- `repositories/category.repository.ts` بيقرا من جدول اسمه `categories`

الاحتمالات:

1. الجداول دي اتعملت يدويًا من لوحة تحكم Supabase مباشرة من غير migration (schema drift — قاعدة البيانات الفعلية مش موثقة في الكود).
2. أو الكود اتكتب قبل ما تتعمل الجداول أصلًا، ومفيش ضمان إنه بيشتغل NOW مع قاعدة بيانات حقيقية.

كمان `docs/DATABASE.md` بيوصف كيانات تانية كتير (Sale, Sale Item, Inventory, Purchase, Customer, Supplier, Cashbox, Expense) ولا واحدة فيهم ليها migration. قاعدة البيانات لسه في بداياتها جدًا مقارنة بالرؤية الموثقة.

---

## 4. أخطاء TypeScript / Lint

### `npx tsc --noEmit` — 3 أخطاء حقيقية

```
components/items/form/ItemForm.tsx(7,10):
  Module '"@/repositories/item.repository"' has no exported member 'createProduct'.

components/items/ItemDialog.tsx(31,37):
  Argument of type 'ProductFormValues' is not assignable to parameter of type 'ItemFormData'.
  Type 'ProductFormValues' is missing the following properties from type 'ItemFormData':
  item_type, has_stock, active, business_id, and 3 more.

SalePopup.tsx(29,19):
  'product' is possibly 'null'.
```

الاتنين الأولانيين هما بالظبط مشكلة Item/Product الأساسية — مؤكدة فعليًا عبر compiler. التالت في نسخة `SalePopup.tsx` الميتة الموجودة في الـ root.

### `npm run lint` — فشل يشتغل خالص (مشكلة إعداد، مش أخطاء كود)

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'eslint-config-next/core-web-vitals' imported from eslint.config.mjs
Did you mean to import "eslint-config-next/core-web-vitals.js"?
```

ملف `eslint.config.mjs` بيعمل import بدون امتداد `.js`، وده بيكسر تحت Node ESM الحالي. عطل مستقل تمامًا عن مشكلة Item/Product، لازم يتصلح لوحده عشان نقدر نشغل lint أصلًا.

---

## 5. Target Architecture مقترح (لسه محدش نفذ حاجة)

بناءً على رؤية `docs/OCTOPUS_CORE.md` و `docs/DATABASE.md` (Item = Product أو Service):

1. **مصدر حقيقة واحد:** `types/item.ts` يبقى هو التعريف الوحيد لـ Item في المشروع كله (الأقرب لرؤية التوثيق: `sale_methods[]`, `units[]`).
2. **حذف/دمج (بعد الموافقة):**
   - `types/product.ts` (تعريف مكرر باسم غلط)
   - `services/product.service.ts` (بيقرا من جدول `products` اللي مش المفروض يكون موجود أصلًا)
   - `data/products.ts` (بيانات hardcoded بتخالف قاعدة التوثيق نفسها)
   - `components/items/ItemForm.tsx` + `components/items/ItemDialog.tsx` (كود ميت، مش مستخدم)
   - `SalePopup.tsx` في الـ root (نسخة مكررة ميتة)
   - `types/cart.ts` (غير مستخدم — يا يتفعّل يا يتشال)
3. **إصلاح `components/items/form/ItemForm.tsx`:** يستخدم `createItem` الحقيقي بدل `createProduct` غير الموجودة، ويتوافق مع شكل `Item` الكامل (`sale_methods`, `units`) مش الشكل القديم (`sell_by_money`/`sell_by_weight`).
4. **كتابة migrations حقيقية** لجداول `items`, `categories`، وبعدين الباقي حسب أولوية الـ Roadmap (`sales`, `sale_items` ...) بما يطابق `docs/DATABASE.md`.
5. **بناء صفحة المبيعات (`sales`) على بيانات حقيقية** من Supabase بدل `data/products.ts` الوهمية.
6. **تفعيل طبقة Features/Services فعليًا** حسب البنية الموثقة (UI → Features → Services → Repositories → Supabase) بدل الصفحات اللي بتنادي الـ repository مباشرة.
7. **إصلاح `eslint.config.mjs`** (مشكلة إعداد منفصلة، بسيطة).

**ملحوظة:** المقارنة مع `octopus-v2` لسه ما اتعملتش — دي تحتاج جلسة مراجعة تانية بعد ما نتفق على خطة التنفيذ هنا في V1، عشان نعرف نجيب منها أي أجزاء صح.

---

*هذا التقرير للمراجعة فقط. لم يتم تعديل أو حذف أي ملف في المشروع أثناء إعداده.*
