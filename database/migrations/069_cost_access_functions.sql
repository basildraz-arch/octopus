-- 069 - أبواب التكلفة. **الجزء الإضافي - بيتطبّق قبل رفع الكود.**
--
-- الميجريشن ده مابيقفلش حاجة. بيفتح الأبواب البديلة بس: دوال بترجّع
-- الكمية المتاحة وتوزيعها وقيمة المخزون من غير ما تعدّي التكلفة،
-- وview بيدي التكلفة للي معاه صلاحية.
--
-- اتقسم لجزئين عن قصد. لو المنع اتطبّق قبل ما الكود اللي بيستعمل
-- الأبواب دي يترفع، البيع نفسه هيقف - لأن التحقق من التوفّر بينادي
-- دالة لسه مش موجودة. فالترتيب:
--
--   1. 069 (ده)          -> يتطبّق دلوقتي. مابيكسرش حاجة.
--   2. رفع الكود
--   3. 070               -> يتطبّق بعد الرفع. هو اللي بيقفل.

-- ---------------------------------------------------------------- ١
-- الكاشير محتاج يعرف "فيه كام متاح؟" مش محتاج يقرا الدفعات.
--
-- الدالة دي بتجاوب على السؤال ده من غير ما تدي وصول للجدول، فبعد كده
-- نقدر نقفل قراءة stock_batches على اللي معاهم صلاحية بس.
create or replace function public.available_quantity(
    p_item_id uuid,
    p_warehouse_id uuid
)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(b.remaining_quantity), 0)
  from stock_batches b
  where b.item_id = p_item_id
    and b.warehouse_id = p_warehouse_id
    and b.remaining_quantity > 0
    and b.business_id = get_my_business_id()
$$;

comment on function public.available_quantity(uuid, uuid) is
  'الكمية المتاحة من صنف في مخزن. بترجّع رقم واحد - من غير تكلفة ولا تفاصيل دفعات.';

-- نفس الفكرة: توزيع الكمية على المخازن، من غير أي تكلفة.
create or replace function public.stock_by_warehouse(p_item_id uuid)
returns table (warehouse_id uuid, warehouse_name text, quantity numeric)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.warehouse_id, w.name, sum(b.remaining_quantity)
  from stock_batches b
  join warehouses w on w.id = b.warehouse_id
  where b.item_id = p_item_id
    and b.remaining_quantity > 0
    and b.business_id = get_my_business_id()
  group by b.warehouse_id, w.name
$$;

-- ---------------------------------------------------------------- ٢
-- قيمة المخزون رقم واحد مجمّع، والمساعد بيسأل عنه. بيتحسب هنا عشان
-- ما يحتاجش وصول لعمود التكلفة من بره.
create or replace function public.inventory_value()
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when has_read_permission('view_reports') then
      coalesce((
        select sum(i.stock * i.buy_price)
        from items i
        where i.business_id = get_my_business_id()
          and i.active = true
          and i.has_stock = true
      ), 0)
    else null
  end
$$;

-- ---------------------------------------------------------------- ٣
-- الباب الوحيد للتكلفة.
--
-- الـview مملوك للـpostgres فبيشتغل بصلاحياته، وعشان كده الشرطين
-- اللي جواه هما كل الحماية: العزل بين المحلات، والصلاحية. لو حد شال
-- سطر منهم يبقى فتح الباب على الآخر.
create or replace view public.item_costs as
select i.id, i.business_id, i.buy_price
from items i
where i.business_id = get_my_business_id()
  and (
    has_read_permission('view_reports')
    or has_read_permission('receive_stock')
    or has_read_permission('manage_items')
  );

grant select on public.item_costs to authenticated;
revoke all on public.item_costs from anon;

-- ملاحظة اتعلمناها هنا: revoke ... from anon لوحده مش كفاية على
-- الدوال. PUBLIC بياخد EXECUTE افتراضيًا على أي دالة جديدة، وanon
-- بيورث منه - فالمنع بيعدّي شكليًا والصلاحية بتفضل مفتوحة. اتأكدنا
-- بـhas_function_privilege بعد التطبيق ولقيناها لسه true.
revoke all on function public.available_quantity(uuid, uuid) from public, anon;
revoke all on function public.stock_by_warehouse(uuid) from public, anon;
revoke all on function public.inventory_value() from public, anon;

grant execute on function public.available_quantity(uuid, uuid) to authenticated;
grant execute on function public.stock_by_warehouse(uuid) to authenticated;
grant execute on function public.inventory_value() to authenticated;



-- لازم يفضل آخر سطر.
--
-- Supabase بيمسك فهرس للدوال المتاحة، والفهرس ده مابيتحدّثش فورًا بعد
-- إضافة دالة جديدة. النتيجة: التطبيق بينادي دالة موجودة في القاعدة
-- والرد بيرجع "مش لاقيها". حصل فعلًا هنا - البيع وقف وقال للكاشير إن
-- المخزون خلص وهو مليان.
--
-- أي ميجريشن بيضيف دالة لازم ينتهي بالسطر ده.
notify pgrst, 'reload schema';
