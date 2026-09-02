-- ============================================================
-- فحص صحة القاعدة — يتشغّل كله مرة واحدة
-- ============================================================
--
-- الفحوصات دي اتكتبت ليلة ٢ سبتمبر ٢٠٢٦ وهي بتدوّر، ولقت فعلًا:
-- دالة سايبة على الإنترنت، وعدّاد فواتير قابل للترجيع من المتصفح،
-- ودفعات مخزون من محل على أصناف محل تاني.
--
-- **شغّله بعد أي ميجريشن، وقبل أي رفعة كبيرة.** كله قراءة -
-- مابيغيّرش ولا صف.
--
-- الاستعمال: انسخه في محرر SQL في Supabase ودوس Run.
-- أي سطر رقمه مش صفر عايز نظرة.

-- ------------------------------------------------------------
-- ١. سلامة البيانات
-- ------------------------------------------------------------

select 'فاتورة إجماليها ≠ مجموع سطورها' as الفحص, count(*) as العدد, 'لازم صفر' as المتوقع
from (
  select s.id from sales s
  left join sale_items si on si.sale_id = s.id
  group by s.id, s.total, s.discount_amount
  having abs(s.total - (coalesce(sum(si.total),0) - s.discount_amount)) > 0.01
) x

union all
select 'صنف مخزونه ≠ مجموع دفعاته', count(*), 'لازم صفر' from (
  select i.id from items i
  left join stock_batches sb on sb.item_id = i.id and sb.business_id = i.business_id
  where i.has_stock
  group by i.id, i.stock
  having abs(i.stock - coalesce(sum(sb.remaining_quantity),0)) > 0.0001
) y

union all
select 'دفعة من محل غير محل صنفها', count(*), 'لازم صفر — تريجر ٠٩٦'
from stock_batches sb join items i on i.id = sb.item_id
where sb.business_id is distinct from i.business_id

union all
select 'دفعة متبقّيها أكبر من كميتها', count(*), 'لازم صفر — CHECK ٠٨٣'
from stock_batches where remaining_quantity > quantity

union all
select 'دفعة بمتبقّي سالب', count(*), 'لازم صفر'
from stock_batches where remaining_quantity < 0

union all
select 'صنف بسعر بيع سالب', count(*), 'لازم صفر — CHECK ٠٨٣'
from items where sell_price < 0

union all
select 'صنف له وصفة وله مخزون', count(*), 'لازم صفر — الأب مالوش مخزون' from (
  select distinct ic.parent_item_id from item_components ic
  join items i on i.id = ic.parent_item_id where i.has_stock and i.stock <> 0
) z

union all
select 'سطر بيع لصنف من محل تاني', count(*), 'لازم صفر'
from sale_items si join sales s on s.id = si.sale_id join items i on i.id = si.item_id
where i.business_id <> s.business_id

union all
select 'فاتورة من غير سطور', count(*), 'لازم صفر'
from sales s where not exists (select 1 from sale_items si where si.sale_id = s.id)

union all
select 'فاتورة من غير رقم مسلسل', count(*), 'لازم صفر — ميجريشن ٠٩٣'
from sales where invoice_number is null

union all
select 'رقم فاتورة مكرر في نفس المحل', count(*), 'لازم صفر — unique index ٠٩٥' from (
  select business_id, invoice_number from sales
  where invoice_number is not null
  group by 1,2 having count(*) > 1
) d

union all
-- الخدمات مالهاش تكلفة وde صح. ده بيدوّر على **بضاعة** من غير تكلفة.
select 'سطر بيع بضاعة من غير تكلفة', count(*), 'لازم صفر'
from sale_items si join items i on i.id = si.item_id
where si.cost is null and i.item_type <> 'service'

union all
select 'مستخدم مربوط بمحل مش موجود', count(*), 'لازم صفر'
from users u where not exists (select 1 from businesses b where b.id = u.business_id)

union all
select 'وردية مفتوحة من أكتر من ٢٤ ساعة', count(*), 'صفر يا ريت — الأرقام بتبوظ'
from shifts where closed_at is null and opened_at < now() - interval '24 hours'

-- ------------------------------------------------------------
-- ٢. الصلاحيات
-- ------------------------------------------------------------

union all
-- المصيدة اللي في AGENTS §١: PUBLIC بياخد EXECUTE افتراضيًا.
select 'دالة الزوار (anon) يقدروا ينادوها', count(*), 'لازم صفر'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and has_function_privilege('anon', p.oid, 'execute')

union all
-- SECURITY DEFINER من غير search_path مثبّت = باب تصعيد صلاحيات.
select 'دالة SECURITY DEFINER من غير search_path', count(*), 'لازم صفر'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and (p.proconfig is null
       or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))

union all
-- النمط اللي بيسرّب: policy FOR ALL بتدّي كتابة لأي عضو في المحل.
-- التلاتة الموجودين حاليًا مقصودين (أدمن المنصة، وصاحب المحل).
select 'policy من نوع FOR ALL', count(*), 'راجعها واحدة واحدة'
from pg_policies where schemaname = 'public' and cmd = 'ALL'

union all
select 'جدول RLS مقفولة عليه', count(*), 'لازم صفر'
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

order by 2 desc;
