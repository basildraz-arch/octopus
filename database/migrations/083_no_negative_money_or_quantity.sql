-- ٠٨٣ — الأرقام السالبة ممنوعة على مستوى القاعدة
--
-- ليه هنا مش في الكود:
--
-- الاستيراد كان بيقبل "-50" في عمود السعر (`toNumber` بتشيل الحروف
-- وبتسيب الشرطة). اتصلح في `lib/importCatalog.ts` — بس ده باب واحد.
-- الأبواب التانية اللي بتكتب في نفس الأعمدة: شاشة الصنف، المشتريات،
-- تحويل المخزون، والمساعد الذكي. تصليح كل باب لوحده معناه إن الباب
-- الجاي هيفتح تاني.
--
-- الشرط هنا بيقفلهم كلهم مرة واحدة، ومابيهمّوش الكود جاي منين.
--
-- سعر بيع بالسالب مش خطأ تجميلي: الصنف بيبقى **بيقلّل** الفاتورة.
-- زوّد منه ٢٠ حبة والإجمالي ينزل. ومحدش بيبص على سطر سعره -٥٠ في
-- قايمة ١٠٠ صنف.
--
-- اتأكدنا قبل التطبيق إن مفيش ولا صف مخالف في القاعدة الحقيقية:
-- items ١٠١، sale_items ٥٦، stock_batches ١١٩، purchases ١٨،
-- expenses ١٣، sales ٥٢ — كلهم نضاف.
--
-- **ملاحظة للمستقبل:** لو اتضافت فيتشر مرتجعات (`refund_sale` موجودة
-- كصلاحية بس مفيش كود بينفّذها)، المرتجع لازم يتسجّل كحركة موجبة في
-- اتجاه معاكس، مش كسطر بيع بالسالب. الشروط دي بتفرض القرار ده.
--
-- اتجرّب بعد التطبيق: سعر -٥٠ اترفض، رصيد -٧ اترفض، دفعة متبقّيها
-- أكبر من كميتها اترفض، مصروف بصفر وبالسالب اترفضوا. مفيش صف اختبار
-- اتساب في القاعدة.

alter table public.items
  add constraint items_prices_not_negative check (
    sell_price >= 0
    and (sell_price_2 is null or sell_price_2 >= 0)
    and (sell_price_3 is null or sell_price_3 >= 0)
    and buy_price >= 0
  ),
  add constraint items_quantities_not_negative check (
    stock >= 0 and minimum_stock >= 0
  );

alter table public.sale_items
  add constraint sale_items_positive check (
    quantity > 0 and unit_price >= 0 and total >= 0 and cost >= 0
  );

-- `remaining_quantity <= quantity` مش تحصيل حاصل: ده بيمنع "إرجاع"
-- دفعة اتسحبت بإن حد يرفع المتبقي فوق الأصل، وde كان هيخلق بضاعة
-- من العدم بتكلفة قديمة.
alter table public.stock_batches
  add constraint stock_batches_positive check (
    quantity > 0
    and remaining_quantity >= 0
    and remaining_quantity <= quantity
    and buy_price >= 0
  );

alter table public.purchases
  add constraint purchases_positive check (
    quantity > 0 and buy_price >= 0 and total >= 0
  );

alter table public.expenses
  add constraint expenses_positive check (amount > 0);

alter table public.sales
  add constraint sales_total_not_negative check (total >= 0);
