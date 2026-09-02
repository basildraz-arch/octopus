-- ============================================================
-- 095 — سلامة دفتر الفواتير + قفل دالة سايبة
-- ============================================================
--
-- مراجعة أمنية بعد ميجريشن ٠٩٣ و٠٩٤ (٢ سبتمبر ٢٠٢٦، والمشروع
-- شغّال على محل حقيقي). تلات حاجات اتلقت، **الأولانية أخطرهم
-- وماليهاش علاقة بالشغل الجديد أصلًا**.

-- ------------------------------------------------------------
-- ١. دالة سايبة على الإنترنت من غير أي تحقق
-- ------------------------------------------------------------
--
-- `correct_purchase_price(item, price, note)` اتلقت بمسح صلاحيات
-- الدوال. الوصف بالكامل:
--
--   * `SECURITY DEFINER` → بتتنفّذ بصلاحيات postgres وبتتخطى RLS
--   * **من غير `search_path` مثبّت** → الدالة الوحيدة في المشروع
--     كده، وde باب معروف لتصعيد الصلاحيات
--   * **من غير أي تحقق هوية أو صلاحية** - مفيش
--     `get_my_business_id()` ولا `has_permission()` ولا حتى سؤال
--     عن المحل صاحب الصنف
--   * **`anon` عنده EXECUTE** - يعني أي حد على الإنترنت بالمفتاح
--     العام، من غير تسجيل دخول
--   * وبتكتب: بتغيّر `stock_batches.buy_price` لأي صنف في أي محل
--
-- يعني: زائر مش مسجّل دخول يعرف (أو يخمّن) رقم صنف، يقدر يغيّر
-- تكلفته في أي محل - فتقارير الأرباح وقيمة المخزن تبوظ بشكل دائم
-- ومحدش يعرف ليه.
--
-- **اللي منع الاستغلال النهارده كان الصدفة.** الدالة بتكتب في
-- جدول اسمه `item_cost_changes` **مش موجود**، والـinsert قبل
-- الـupdate - فبترمي خطأ قبل ما تعدّل. اتجرّب بدور `anon` بالفعل:
--
--   تكلفة الدفعات قبل=6.455  بعد=6.455
--   الرد=relation "item_cost_changes" does not exist
--
-- يعني أول ما أي حد يعمل الجدول ده لأي سبب، الثغرة بتشتغل.
--
-- الدالة **مش مستعملة في أي مكان** في الكود (اتفحص كل .ts و.tsx
-- و.sql). شكلها بقايا إصلاح استيراد إكسل اتعمل من محرر SQL.
--
-- **دالة ميتة + مكسورة + مفتوحة للزوار = لغم.** بتتشال.
--
-- والدرس أعم من الدالة دي: أي حاجة تتعمل من محرر SQL بره
-- الميجريشنز مابتاخدش مراجعة، ومابتظهرش في الكود، وبتفضل موجودة
-- سنين. لو محتاج دالة مؤقتة، امسحها في نفس الجلسة.

drop function if exists public.correct_purchase_price(uuid, numeric, text);

-- ------------------------------------------------------------
-- ٢. صاحب المحل كان يقدر يرجّع ترقيم فواتيره لورا
-- ------------------------------------------------------------
--
-- `businesses` عليها `GRANT UPDATE` على مستوى **الجدول** (مش
-- الأعمدة)، وpolicy `businesses_owner_update` بتسمح للمالك يعدّل
-- صف محله. يعني `next_invoice_number` اللي اتضاف في ٠٩٣ بقى
-- قابل للتعديل من المتصفح - رغم إني ماديتش عليه grant.
--
-- **وde درس مقلوب للي مكتوب في AGENTS §١:** المنع على مستوى
-- العمود بيشتغل مع SELECT هنا لأن `revoke select on الجدول`
-- اتعمل قبله. UPDATE **مااتعملهاش نفس الحركة**، فلسه على مستوى
-- الجدول - يعني كل عمود جديد **مسموح** بالكتابة افتراضيًا، عكس
-- القراءة بالظبط.
--
-- اتجرّب بحساب كيرو (مالك حقيقي):
--
--   العدّاد قبل=54  بعد=1  |  رد التعديل=عدّى من غير أي خطأ
--
-- الفاتورة الجاية كانت هتبقى رقم ١ تاني - **رقم مكرر في دفتر
-- فواتير ضريبي**، بصمت، ومحدش هيلاحظ غير بعد شهور.
--
-- الحل تريجر زي إخواته (`protect_plan_columns` وغيرها): العدّاد
-- بيتحرك من `record_sale` بس (SECURITY DEFINER فبتشتغل بصلاحيات
-- المالك مش بـauth.role)، ومن الإدارة بمفتاح service_role.

create or replace function public.protect_invoice_counter()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
    -- ============================================================
    -- `current_user` مش `auth.role()` — والفرق كان هيوقّف المحل
    -- ============================================================
    --
    -- أول نسخة من التريجر ده كانت مكتوبة
    -- `auth.role() = 'authenticated'` زي إخواته
    -- (`protect_plan_columns` وغيرها). **وde كان هيرفض كل بيعة في
    -- البرنامج.**
    --
    -- السبب إن إخواته بيحموا أعمدة **محدش بيلمسها غير من
    -- الإعدادات**، أما العمود ده بيتحرك جوه `record_sale` مع كل
    -- بيعة. و`auth.role()` بتقرا من الـJWT، والـJWT
    -- **مابيتغيّرش** جوه دالة `SECURITY DEFINER` - فبتفضل
    -- `'authenticated'` وإحنا جوه `record_sale` بالظبط زي ما
    -- الكاشير بيكتب من المتصفح.
    --
    -- `current_user` بيفرّق فعلًا: PostgREST بيشتغل بدور
    -- `authenticated`، وجوه دالة `SECURITY DEFINER` مملوكة لـ
    -- postgres بيبقى `'postgres'`.
    --
    -- اتمسك بالتجربة قبل ما ينزل: بيعة حقيقية عدّت والعدّاد اتحرك
    -- ٥٤→٥٥، ومحاولة ترجيعه من المتصفح اترفضت.
    --
    -- **القاعدة: `auth.role()` بيقول مين المستخدم. `current_user`
    -- بيقول الكتابة جاية من فين.**
    if new.next_invoice_number is distinct from old.next_invoice_number
       and current_user = 'authenticated'
    then
        raise exception 'ترقيم الفواتير مابيتغيّرش من الإعدادات';
    end if;

    return new;
end;
$$;

-- المصيدة اللي في AGENTS §١ وقعت فيها وأنا بكتب الملف ده:
-- `PUBLIC` بياخد `EXECUTE` افتراضيًا على أي دالة جديدة، ودوال
-- التريجر مش استثناء. اتلقت في نفس الليلة بفحص الصلاحيات:
-- الدالة طلعت مكشوفة لـ`anon`.
--
-- التريجر **مابيحتاجش الصلاحية دي عشان يشتغل** - القاعدة بتنفّذه
-- كجزء من عملية الجدول، مش بصلاحية الدور. اتأكدنا بالتجربة بعد
-- السحب: التريجر لسه بيرفض، والبيعة لسه بتعدي.
revoke all on function public.protect_invoice_counter()
  from public, anon, authenticated;

drop trigger if exists trg_protect_invoice_counter on public.businesses;

create trigger trg_protect_invoice_counter
before update on public.businesses
for each row execute function public.protect_invoice_counter();

-- والحزام التاني: حتى لو حاجة حرّكت العدّاد لورا بطريقة ما،
-- الرقم المكرر **مايتسجّلش أصلًا**. البيعة بترفض بدل ما تعدي
-- بفاتورتين بنفس الرقم.
--
-- اتأكدنا من عدم وجود تكرار قبل الإضافة (٠ صفوف).
create unique index if not exists sales_invoice_no_per_business
  on public.sales (business_id, invoice_number)
  where invoice_number is not null;

-- ------------------------------------------------------------
-- ٣. الفاتورة الملغية كانت بتاخد رقمها معاها
-- ------------------------------------------------------------
--
-- `void_sale` بتمسح الصف من `sales` (وde صح - الفاتورة اتسجّلت
-- غلط أصلًا، مش بيعة رجعت). وقبل الترقيم ماكانش فيه مشكلة.
--
-- بعد ٠٩٣ بقى فيه: إلغاء فاتورة رقم ٤٧ بيسيب **فجوة في دفتر
-- الفواتير** من غير أي تفسير. ودفتر ضريبي فيه فجوة من غير سبب
-- مكتوب هو أول حاجة بيتسأل عنها.
--
-- السجل (`sale_voids`) كان بيحفظ الإجمالي والأصناف والسبب -
-- **بس مش الرقم**، لأنه اتكتب قبل ما الترقيم يبقى موجود. أنا
-- ضفت الترقيم امبارح ومالمستش الإلغاء.
--
-- دلوقتي الرقم بيتحفظ، فالفجوة ليها سطر بيفسّرها: "رقم ٤٧ اتلغت
-- يوم كذا، السبب كذا، الإجمالي كان كذا".

alter table public.sale_voids
  add column if not exists invoice_number bigint;

-- ترقيم الإلغاءات القديمة مش ممكن - الصف اتمسح من `sales` خلاص
-- والرقم راح معاه. بتفضل null، وde صح: مانخترعش رقم.

create or replace function public.void_sale(
    p_sale_id uuid,
    p_reason text default null,
    p_warehouse_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_business uuid := get_my_business_id();
    v_sale     record;
    v_wh       uuid;
    v_lines    jsonb;
    li record;
begin
    if v_business is null then
        raise exception 'غير مصرّح';
    end if;

    if not business_is_active(v_business) then
        raise exception 'الاشتراك مقفول';
    end if;

    if not has_permission('refund_sale') then
        raise exception 'إلغاء الفواتير لصاحب النشاط بس';
    end if;

    select s.*, sh.closed_at into v_sale
    from sales s
    left join shifts sh on sh.id = s.shift_id
    where s.id = p_sale_id and s.business_id = v_business;

    if not found then
        raise exception 'الفاتورة مش موجودة';
    end if;

    if v_sale.closed_at is not null then
        raise exception 'اليوم ده اتقفل — افتحه الأول عشان تلغي فاتورة منه';
    end if;

    v_wh := p_warehouse_id;

    if v_wh is null then
        select id into v_wh from warehouses
        where business_id = v_business
        order by is_default desc, created_at
        limit 1;
    end if;

    if v_wh is null or not exists (
        select 1 from warehouses where id = v_wh and business_id = v_business
    ) then
        raise exception 'المخزن مش من نشاطك';
    end if;

    select jsonb_agg(jsonb_build_object(
               'item_id', si.item_id,
               'name', coalesce(i.name, 'صنف متمسوح'),
               'quantity', si.quantity,
               'unit_price', si.unit_price,
               'total', si.total,
               'cost', si.cost
           ) order by si.created_at)
    into v_lines
    from sale_items si
    left join items i on i.id = si.item_id
    where si.sale_id = p_sale_id;

    insert into sale_voids (
        business_id, sale_id, voided_by, reason,
        sale_total, sale_created_at, lines, invoice_number
    ) values (
        v_business, p_sale_id, my_user_id(),
        nullif(btrim(coalesce(p_reason, '')), ''),
        v_sale.total, v_sale.created_at, coalesce(v_lines, '[]'::jsonb),
        v_sale.invoice_number
    );

    for li in
        select si.item_id, si.quantity, si.cost
        from sale_items si
        where si.sale_id = p_sale_id
    loop
        perform return_line_to_stock(
            v_business, li.item_id, li.quantity, li.cost, v_wh, v_sale.created_at
        );
    end loop;

    delete from sale_items where sale_id = p_sale_id;
    delete from sales where id = p_sale_id and business_id = v_business;
end;
$function$;

notify pgrst, 'reload schema';
