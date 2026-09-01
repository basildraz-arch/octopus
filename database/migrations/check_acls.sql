-- 084b: فحص شامل لصلاحيات دوال المساعد
-- نشوف كل الدوال المعنية وإيه صلاحياتها الحقيقية من الجداول النظامية

-- 1) مين عنده execute على spend_assistant_message؟
select
  p.proname as function_name,
  p.proacl as current_acl
from pg_proc p
where p.proname in (
  'spend_assistant_message',
  'inventory_value',
  'available_quantity',
  'stock_by_warehouse'
);
