-- ============================================================
-- 097 — الكاشير كان يقدر يخفي أي صنف من شاشة البيع
-- ============================================================
--
-- اتلقت في مصفوفة الكتابة بحساب **عمار** (كاشير حقيقي في محل
-- كيرو، ومعاه `close_day` و`receive_stock` لأن كيرو اداهمله).
--
-- التريجر `protect_item_pricing_columns` بيرفض للكاشير يغيّر
-- السعر والاسم و`active`. اتجرّب وكل ده اترفض فعلًا:
--
--   السعر:  تعديل أسعار وبيانات الأصناف لصاحب النشاط بس  (50.00→50.00)
--   الاسم:  تعديل أسعار وبيانات الأصناف لصاحب النشاط بس  (7up)
--   التعطيل: تعديل أسعار وبيانات الأصناف لصاحب النشاط بس
--
-- **بس `is_ingredient` عدّى.**
--
--   مكوّن: عدّى!!  (t)
--
-- ------------------------------------------------------------
-- ليه ده مهم
-- ------------------------------------------------------------
--
-- `is_ingredient = true` معناها إن الصنف **يختفي من شاشة البيع
-- خالص** (`getActiveItems` بتفلتر عليه، ميجريشن ٠٩١). يعني
-- تأثيرها العملي **نفس تأثير `active = false`** بالظبط - واللي
-- محمي والتاني لأ.
--
-- كاشير معاه `receive_stock` كان يقدر يخفي أي صنف من الكاشير،
-- بصمت، من غير أي أثر، وصاحب المحل يفضل مش فاهم "7up راح فين من
-- الشاشة".
--
-- ------------------------------------------------------------
-- الغلطة اللي وقعت فيها
-- ------------------------------------------------------------
--
-- ميجريشن ٠٩١ ضاف `is_ingredient` وضاف الـgrants بتاعته (اللي
-- كنت هنساها وموثّقة في AGENTS §١). **بس مالمسش طبقة التريجرات.**
--
-- والتريجرات مكتوبة بقايمة أعمدة صريحة، فأي عمود جديد
-- **مابيتحميش افتراضيًا**. نفس شكل مصيدة الـgrants بالظبط، بس في
-- الاتجاه التاني: هناك العمود الجديد ممنوع لحد ما تسمح، وهنا
-- مسموح لحد ما تمنع.
--
-- **القاعدة: أي عمود جديد في `items` يتسأل عنه سؤالين -**
-- **مين يقرا؟ (grants) ومين يكتب؟ (تريجر).**
--
-- واتضاف معاه `has_stock` و`unit` لنفس السبب: الأول بيقرر هل
-- الصنف بيتتبع مخزونه أصلًا، والتاني بيغيّر معنى كل رقم كمية
-- على الصنف. الاتنين تعريف الصنف، مش تشغيله.
--
-- `minimum_stock` و`keywords` و`image` **اتسابوا مسموحين** عن
-- قصد: الكاشير اللي بيزوّد البضاعة أولى واحد يظبط حد إعادة
-- الطلب أو يزوّد كلمة بحث، ومفيش ضرر في الاتنين.

create or replace function public.protect_item_pricing_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
    if auth.role() = 'service_role' or is_business_owner() or has_permission('manage_items') then
        return new;
    end if;

    if new.sell_price is distinct from old.sell_price
       or new.sell_price_2 is distinct from old.sell_price_2
       or new.sell_price_3 is distinct from old.sell_price_3
       or new.min_sell_price is distinct from old.min_sell_price
       or new.name is distinct from old.name
       or new.barcode is distinct from old.barcode
       or new.category_id is distinct from old.category_id
       or new.item_type is distinct from old.item_type
       or new.sale_method is distinct from old.sale_method
       or new.active is distinct from old.active
       or new.business_id is distinct from old.business_id
       -- الجداد. `is_ingredient` بتخفي الصنف من البيع زي
       -- `active` بالظبط، فمالهاش سبب تكون أخف منها.
       or new.is_ingredient is distinct from old.is_ingredient
       or new.has_stock is distinct from old.has_stock
       or new.unit is distinct from old.unit
    then
        raise exception 'تعديل أسعار وبيانات الأصناف لصاحب النشاط بس';
    end if;

    return new;
end;
$function$;
