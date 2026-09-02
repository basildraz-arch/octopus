-- ============================================================
-- 096 — الدفعة والصنف والمخزن لازم يكونوا لنفس المحل
-- ============================================================
--
-- اتلقت في فحص سلامة بيانات على القاعدة الحقيقية: صنفين من محل
-- كيرو (`7up` و`Americano D`) مخزونهم في `items` نص مجموع دفعاتهم.
--
-- الدفعتين الزيادة اتعملوا **١ سبتمبر ٧:٣٤ و٧:٣٦ مساءً**، يعني
-- جوه جلسة الشغل نفسها، وشكلهم كده:
--
--   الصنف بتاع    → محل كيرو
--   الدفعة بتاعة  → محل باسل التجريبي
--   المخزن بتاع   → محل باسل التجريبي
--   سعر الشرا     → 0.00
--
-- ------------------------------------------------------------
-- إزاي حصلت
-- ------------------------------------------------------------
--
-- كانت لسه فيه policy اسمها `platform_admin_read` بتخلّي باسل
-- يشوف أصناف كل المحلات مخلوطة في شاشته (١٩٣ صنف من ٨ محلات).
-- فتح صنف من محل كيرو وهو فاكره بتاعه وعدّل الكمية، و
-- `adjustItemStock` عملت دفعة بـ**رقم محل باسل ومخزن باسل** على
-- **صنف كيرو**.
--
-- والـRLS ماوقفتهاش، وde منطقي: هي بتسأل "الدفعة دي من محلك؟"
-- والإجابة كانت أيوة. **محدش سأل: والصنف اللي فيها من محلك
-- كمان؟**
--
-- الخلط نفسه اتقفل في ٠٩٢ (شيل الـpolicy) و`updateItem` بقت
-- ترمي رسالة بدل ما تنجح بصمت. الملف ده بيقفل الباب اللي عدّى منه.
--
-- ------------------------------------------------------------
-- الضرر الحقيقي كان أقل من شكله
-- ------------------------------------------------------------
--
-- تريجر `items_derive_stock_and_cost` بيحسب المخزون من الدفعات
-- **بشرط `business_id = old.business_id`** - فدفعات باسل
-- ماكانتش داخلة في حساب صنف كيرو أصلًا. مخزون كيرو المعروض كان
-- صح (٢٣ و١٠٠) وتكلفته كانت صح (12.91).
--
-- يعني: صفوف زبالة في تاريخ الصنف، مش أرقام غلط على الشاشة.
-- اتشالت عشان أي مراجعة جرد بعدين ماتقفش عندها، وعشان أي كود
-- جاي ينسى الشرط ده مايلاقيش لغم مستني.

-- ------------------------------------------------------------
-- ١. تنضيف الصفين
-- ------------------------------------------------------------
--
-- الاتنين `remaining_quantity = quantity` يعني محدش سحب منهم ولا
-- مرة، ومفيش أي جدول بيشاور عليهم (اتفحص: صفر مفاتيح أجنبية على
-- `stock_batches`). الحذف مالوش أثر جانبي.

delete from public.stock_batches sb
using public.items i
where sb.item_id = i.id
  and sb.business_id is distinct from i.business_id;

-- وإعادة الحساب: التريجر بيشتغل على أي UPDATE، فكتابة العمود
-- بقيمته الحالية كفاية عشان يعيد الاشتقاق من الدفعات.
update public.items set stock = stock
where id in (
  select id from public.items where has_stock
);

-- ------------------------------------------------------------
-- ٢. القاعدة اللي كانت ناقصة
-- ------------------------------------------------------------
--
-- ثلاثة أرقام لازم يتطابقوا: محل الدفعة، ومحل الصنف اللي فيها،
-- ومحل المخزن اللي هي فيه. أي اختلاف معناه إن حاجة اتخلطت.
--
-- تريجر مش CHECK constraint، لأن الشرط بيقرا من جدولين تانيين
-- و`CHECK` مابيقدرش يعمل كده.
--
-- والرسالة بالعربي وموجّهة: اللي هيشوفها غالبًا بيعدّل صنف من
-- شاشة الماستر، والمطلوب يفهم إنه لازم يدخل من حساب المحل نفسه.

create or replace function public.batch_matches_item_and_warehouse()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
    v_item_business uuid;
    v_wh_business   uuid;
begin
    select business_id into v_item_business from items where id = new.item_id;

    if v_item_business is null then
        raise exception 'الصنف مش موجود';
    end if;

    if v_item_business <> new.business_id then
        raise exception 'الصنف ده من محل تاني - افتحه من حساب المحل نفسه';
    end if;

    if new.warehouse_id is not null then
        select business_id into v_wh_business
        from warehouses where id = new.warehouse_id;

        if v_wh_business is distinct from new.business_id then
            raise exception 'المخزن ده مش من نفس المحل';
        end if;
    end if;

    return new;
end;
$$;

-- نفس سبب السحب في ٠٩٥: `PUBLIC` بياخد `EXECUTE` افتراضيًا حتى
-- على دوال التريجر، والتريجر مش محتاجها عشان يشتغل.
revoke all on function public.batch_matches_item_and_warehouse()
  from public, anon, authenticated;

drop trigger if exists trg_batch_matches_item on public.stock_batches;

create trigger trg_batch_matches_item
before insert or update on public.stock_batches
for each row execute function public.batch_matches_item_and_warehouse();

notify pgrst, 'reload schema';
