-- 072 - سعر الشرا والمخزون في items بقوا **مشتقّين**، مش مكتوبين من المتصفح.
--
-- المشكلة اللي كشفت ده:
--
-- ميجريشن 070 منعت قراءة items.buy_price - وde كان صح. بس الكتابة
-- فضلت مسموحة (INSERT/UPDATE لسه معطيين للدور authenticated). والنتيجة
-- إن أي شاشة بتقرا التكلفة وترجّع تكتبها بقت بتكتب **صفر**، من غير أي
-- خطأ:
--
--   ItemForm بتعمل  buy_price: item.buy_price ?? 0
--   والقراءة بترجّع undefined دلوقتي، فالافتراضي بيبقى 0
--   وonSubmit بتبعت buy_price جوه الـupdate
--
-- يعني صاحب المحل يفتح صنف عشان يعدّل **اسمه**، ويحفظ، فتكلفة الصنف
-- تتمسح. من غير رسالة خطأ. البيعة الجاية تحسب ربح أكبر من الحقيقة.
--
-- اتأكدنا إن ده لسه ماحصلش على البيانات الحقيقية (مفيش صنف تكلفته صفر
-- ودفعاته بتكلفة) - الثغرة كانت مستنية أول تعديل صنف بس.
--
-- الحل مش "نصلّح النموذج". النموذج واحد من كام مكان بيكتب التكلفة:
--   repositories/purchase.repository.ts
--   repositories/stockTransfer.repository.ts
--   repositories/item.repository.ts (adjustItemStock)
-- وكلهم بيحسبوا المتوسط في المتصفح من getCurrentStockAndCost - اللي
-- بترجّع {0, 0} لو حصل خطأ اتصال. نفس النمط اللي حذّر منه AGENTS §1:
-- دالة بترجّع رقم مضلل عند الخطأ.
--
-- فالقاعدة بقت زي قاعدة items.stock بالظبط (AGENTS §4):
-- **التكلفة والمخزون بيتحسبوا من stock_batches، واللي المتصفح بيبعته
-- بيتجاهل.** مكان واحد للحقيقة، وهو اللي جوه القاعدة.
--
-- التريجر BEFORE UPDATE بس - مش INSERT. وقت الإنشاء الدفعات لسه
-- ماتعملتش (createItem بيعمل الصنف الأول وبعدين الدفعة الافتتاحية)،
-- فلو اشتغل على الإنشاء هيصفّر الصنف الجديد قبل ما دفعته توجد.

create or replace function public.items_derive_stock_and_cost()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_qty   numeric;
    v_value numeric;
begin
    -- الخدمات مالهاش مخزون ولا تكلفة مشتقة
    if not coalesce(new.has_stock, false) then
        return new;
    end if;

    -- security definer عشان التريجر يقرا الدفعات حتى لو اللي بيعدّل
    -- مالوش صلاحية يقراها بنفسه. من غير كده الحساب هيرجع صفر لبعض
    -- الأدوار - وده بالظبط الغلط اللي بنصلّحه.
    select coalesce(sum(remaining_quantity), 0),
           coalesce(sum(remaining_quantity * buy_price), 0)
      into v_qty, v_value
      from stock_batches
     where item_id = new.id
       and business_id = old.business_id
       and remaining_quantity > 0;

    new.stock := v_qty;

    if v_qty > 0 then
        new.buy_price := v_value / v_qty;
    else
        -- صنف خلص مخزونه: مفيش دفعات نحسب منها، فبنسيب آخر تكلفة
        -- معروفة زي ما sell_line بتعمل. تصفيرها هنا هيخلي تقرير
        -- الأرباح يقول إن كل اللي اتباع بعد كده ربح صافي.
        new.buy_price := coalesce(old.buy_price, new.buy_price);
    end if;

    return new;
end;
$$;

comment on function public.items_derive_stock_and_cost() is
  'بتخلي items.stock و items.buy_price مشتقّين من stock_batches وبتتجاهل اللي المتصفح بعته. سبب وجودها إن قراءة buy_price ممنوعة (070) فأي شاشة بتقراها وترجّع تكتبها كانت بتكتب صفر بصمت.';

drop trigger if exists items_derive_stock_and_cost on public.items;

create trigger items_derive_stock_and_cost
    before update on public.items
    for each row
    execute function public.items_derive_stock_and_cost();

notify pgrst, 'reload schema';
