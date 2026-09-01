-- 084: صلاحيات الدوال المالية للمساعد
--
-- المساعد بيسأل عن قيمة المخزون عبر inventory_value()، والدالة دي
-- اتشال منها EXECUTE من PUBLIC في ميجريشن 069 واتمنحت لـauthenticated.
-- لكن نفس الفخ اللي حصل مع spend_assistant_message: أي revoke لاحق
-- من public/anon بيوقع authenticated كمان لو مفيش grant صريح بعدها.
--
-- النتيجة: أي سؤال حر (freeform) بينادي answerFromGemini اللي بيعمل
-- 7 استدعاءات متوازية، واحد منهم inventory_value() -> permission denied
-- -> الريل كله يقع برسالة "حدث خطأ".
--
-- الأسئلة المحسومة بقواعد (زي "مبيعاتي كام") مش بتعدّي هنا، عشان كده
-- كانت شغالة بينما الحر بيقع.

grant execute on function public.inventory_value() to authenticated;

-- احتياط لنفس الفخ على دوال المساعدة التانية
grant execute on function public.available_quantity(uuid, uuid) to authenticated;
grant execute on function public.stock_by_warehouse(uuid) to authenticated;
grant execute on function public.spend_assistant_message() to authenticated;
grant execute on function public.has_read_permission(text) to authenticated;
grant execute on function public.my_user_id() to authenticated;

notify pgrst, 'reload schema';
