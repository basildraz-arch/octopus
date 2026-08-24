-- 076 - **ما تشغّلش الملف ده قبل ما ترفع كود ٠٧٥.**
--
-- ٠٧٥ نقلت البيع لـ`record_sale`، بس سابت `sell_line` مفتوحة للدور
-- `authenticated` عن قصد: وقت ما اتطبّقت، النسخة الشغالة على الموقع
-- كانت لسه بتنادي `sell_line` سطر سطر. لو قفلناها في نفس اللحظة، كل
-- محل كان هيقف عن البيع لحد ما الرفعة تنزل.
--
-- فالترتيب:
--
--   ١. ارفع الكود (`deploy.ps1`)  ← البيع بقى بيمر على record_sale
--   ٢. افتح الموقع واعمل بيعة حقيقية واتأكد إنها عدّت
--   ٣. شغّل الملف ده              ← الباب القديم بيتقفل
--
-- ليه لازم يتقفل: طول ما `sell_line` متاحة للمتصفح، الثغرة اللي
-- ٠٧٥ اتعملت عشانها لسه مفتوحة - أي حد يقدر ينادي:
--
--   rpc('sell_line', { p_unit_price: 1, p_total: 1, ... })
--
-- ويبيع صنف بـ٢٣٠ بجنيه. `record_sale` بتقفل الباب اللي الواجهة
-- بتستعمله، والملف ده بيقفل الباب اللي جنبه.
--
-- `record_sale` نفسها بتنادي `sell_line`، وde هيفضل شغال بعد المنع
-- لأن الاتنين SECURITY DEFINER: الدالة بتتنفّذ بصلاحيات مالكها
-- (postgres) مش بصلاحيات اللي ناداها.
--
-- ولو حصلت مشكلة بعد الرفع ومحتاج ترجع بسرعة:
--   grant execute on function public.sell_line(uuid, uuid, numeric, uuid, numeric, numeric) to authenticated;

revoke all on function
  public.sell_line(uuid, uuid, numeric, uuid, numeric, numeric)
  from public, anon, authenticated;

comment on function public.sell_line(uuid, uuid, numeric, uuid, numeric, numeric) is
  'داخلية - بتتنادى من record_sale بس. مامنوعة على authenticated لأنها بتقبل السعر كمعامل، وde كان بيخلي أي كاشير يبيع بأي سعر (ميجريشن 076).';

notify pgrst, 'reload schema';
