-- 074 - اسطمبات أنشطة إضافية.
--
-- كان في ١١ اسطمبة. الملف ده بيضيف ٣٧ كمان، فالمجموع ٤٨.
--
-- ليه في القاعدة مش في الكود: شاشة التسجيل بتقرا من الجدول ده أصلًا،
-- وصفحة الإعدادات بقت تقرا منه كمان (نفس الرفعة). يعني إضافة نشاط
-- جديد بقت **صف في جدول** - من شاشة الماستر، من غير رفعة كود.
--
-- كل اسطمبة هنا مبنية من الفيتشرز الموجودة فعلًا (١١ فيتشر). مفيش
-- ولا مفتاح جديد اتخترع - مفتاح من غير كود وراه بيبقى وعد كذب في
-- شاشة الأسعار.
--
-- القواعد اللي اتمشى عليها في اختيار الفيتشرز:
--
--   credit_customers  للأنشطة اللي العميل بياخد ويحاسب بعدين
--                     (ورش، جملة، توزيع، عيادات، مطاعم بتوصّل)
--   price_tiers       لأي حد بيبيع قطاعي وجملة بأسعار مختلفة
--   discounts         للتجزئة اللي بتفاصل - مش للصيدلية ولا العيادة
--   inventory         لأي حاجة ليها بضاعة تتعد. الخدمات البحتة لأ.
--   multi_warehouse   للجملة والتوزيع بس - اللي عنده أكتر من مخزن فعلًا
--
-- price_tier_labels لازم تبقى تلاتة بالظبط (CHECK على الجدول).
--
-- on conflict do nothing عن قصد: لو باسل عدّل اسطمبة من الماستر،
-- إعادة تشغيل الملف مالهاش حق ترجّعها.

insert into business_templates
  (business_type, label, icon, description, enabled_features, app_mode,
   price_tier_labels, default_categories, sort_order, ui_labels)
values

-- ===== أكل وشرب =====
('roastery', 'محمصة بن / محل قهوة', '🫘',
 'بتحمّص وتطحن وتبيع بن - بالكيلو وبالباكت',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','price_tiers','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['بن محوّج','بن سادة','خلطات','مستلزمات تحضير'], 11,
 '{"items":"الأصناف","categories":"الأنواع","customers":"الزباين"}'::jsonb),

('bakery', 'مخبز / فرن', '🥖',
 'عيش ومخبوزات - إنتاج يومي بيخلص',
 array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['عيش','مخبوزات','فطاير'], 21,
 '{"items":"المخبوزات","categories":"الأقسام","customers":"الزباين"}'::jsonb),

('sweets', 'حلواني', '🍰',
 'حلويات شرقي وغربي - بالكيلو وبالقطعة',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['حلويات شرقي','جاتوه','بسكويت','مناسبات'], 22,
 '{"items":"الحلويات","categories":"الأقسام"}'::jsonb),

('juice_bar', 'عصير / فريش', '🥤',
 'عصاير طازة ومشروبات',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['عصاير','ميلك شيك','سموذي','إضافات'], 23,
 '{"items":"المشروبات","categories":"الأقسام","sale":"طلب"}'::jsonb),

('cafeteria', 'كافتيريا', '🥪',
 'كافتيريا مدرسة أو شركة أو نادي',
 array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['مشروبات','سندوتشات','سناكس'], 24,
 '{"items":"الأصناف","sale":"طلب"}'::jsonb),

('butcher', 'جزارة', '🥩',
 'لحوم ودواجن - البيع بالوزن',
 array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['لحوم','دواجن','مصنّعات'], 25,
 '{"items":"الأصناف","customers":"الزباين","stock":"البضاعة"}'::jsonb),

('fruits_veg', 'خضار وفاكهة', '🍅',
 'الأسعار بتتغير كل يوم والبيع بالوزن',
 array['pos_sales','inventory','categories','shifts','sales_reports','price_tiers','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['خضار','فاكهة','ورقيات'], 26,
 '{"items":"الأصناف","customers":"الزباين","stock":"البضاعة"}'::jsonb),

('fish', 'محل سمك', '🐟',
 'أسماك ومأكولات بحرية بالوزن',
 array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['أسماك','جمبري وقشريات','مجمد'], 27,
 '{"items":"الأصناف","customers":"الزباين"}'::jsonb),

('dairy', 'ألبان وجبن', '🧀',
 'ألبان وجبن ومسلي - بالوزن وبالعبوة',
 array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['ألبان','أجبان','سمن وزبدة','مخللات'], 28,
 '{"items":"الأصناف","customers":"الزباين"}'::jsonb),

('nuts', 'محمصة مكسرات', '🥜',
 'مكسرات وياميش - بالوزن',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','price_tiers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['مكسرات','ياميش','تسالي','خلطات'], 29,
 '{"items":"الأصناف","categories":"الأنواع"}'::jsonb),

('attar', 'عطارة', '🌿',
 'أعشاب وتوابل وبهارات بالوزن',
 array['pos_sales','inventory','categories','shifts','sales_reports','price_tiers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['بهارات','أعشاب','خلطات','زيوت'], 30,
 '{"items":"الأصناف","customers":"الزباين"}'::jsonb),

('water', 'توزيع مياه وغاز', '💧',
 'توزيع على البيوت - الحساب بيتجمّع على العميل',
 array['pos_sales','inventory','shifts','sales_reports','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['مياه','غاز'], 31,
 '{"items":"الأصناف","customers":"الزباين","sale":"توصيلة"}'::jsonb),

-- ===== تجزئة =====
('mobile_shop', 'محل موبايلات', '📱',
 'موبايلات وإكسسوارات وشحن رصيد',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['موبايلات','إكسسوارات','شواحن','سماعات'], 41,
 '{"items":"المنتجات","stock":"البضاعة"}'::jsonb),

('mobile_repair', 'صيانة موبايلات', '🔌',
 'إصلاح وقطع غيار - أمر شغل لكل جهاز',
 array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['قطع غيار','مصنعية','إكسسوارات'], 42,
 '{"items":"قطع وخدمات","sale":"أمر شغل","customers":"الزباين"}'::jsonb),

('shoes', 'محل أحذية', '👟',
 'أحذية وشنط - مقاسات وألوان',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['رجالي','حريمي','أطفال','شنط'], 43,
 '{"items":"القطع","stock":"البضاعة"}'::jsonb),

('toys', 'محل لعب', '🧸',
 'لعب أطفال وهدايا',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['لعب','هدايا','مستلزمات مناسبات'], 44,
 '{"items":"المنتجات","stock":"البضاعة"}'::jsonb),

('bookstore', 'مكتبة / أدوات مكتبية', '📚',
 'كتب وأدوات مدرسية وطباعة',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','price_tiers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['أدوات مكتبية','كتب','مستلزمات مدارس','طباعة'], 45,
 '{"items":"الأصناف","categories":"الأقسام"}'::jsonb),

('perfume', 'محل عطور', '🧴',
 'عطور ومستحضرات - بالوزن وبالعبوة',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','price_tiers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['عطور','زيوت عطرية','مستحضرات'], 46,
 '{"items":"المنتجات"}'::jsonb),

('optics', 'محل نضارات', '👓',
 'نضارات طبية وشمس وعدسات',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['نضارات طبية','نضارات شمس','عدسات','إكسسوارات'], 47,
 '{"items":"المنتجات","customers":"العملاء"}'::jsonb),

('flowers', 'محل ورد', '💐',
 'ورد وبوكيهات وتنسيق مناسبات',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['ورد','بوكيهات','نباتات','مستلزمات'], 48,
 '{"items":"المنتجات","sale":"طلب"}'::jsonb),

('furniture', 'محل أثاث', '🛋️',
 'أثاث ومفروشات - طلبات كبيرة بالتقسيط',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['غرف نوم','أنتريهات','مطابخ','مفروشات'], 49,
 '{"items":"القطع","sale":"طلب","customers":"العملاء","stock":"البضاعة"}'::jsonb),

('carpets', 'سجاد وموكيت', '🧶',
 'سجاد وموكيت - البيع بالمتر',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','price_tiers','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['سجاد','موكيت','دواسات'], 50,
 '{"items":"الأصناف","stock":"البضاعة"}'::jsonb),

-- ===== عدة ومواد =====
('hardware', 'محل عدة وأدوات', '🔩',
 'عدة يدوية وكهربائية ومسامير بالوزن',
 array['pos_sales','inventory','categories','shifts','sales_reports','price_tiers','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['عدة يدوية','عدة كهربائية','مسامير وخوابير','سباكة','كهرباء'], 61,
 '{"items":"الأصناف","customers":"الزباين","stock":"البضاعة"}'::jsonb),

('paints', 'محل بويات', '🎨',
 'بويات ومستلزمات دهان - باللتر والكيلو',
 array['pos_sales','inventory','categories','shifts','sales_reports','price_tiers','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['بويات','مذيبات','فرش ورولات','مستلزمات'], 62,
 '{"items":"الأصناف","customers":"الزباين"}'::jsonb),

('building_materials', 'مواد بناء', '🧱',
 'أسمنت وحديد ورمل - كميات كبيرة وحساب مؤجل',
 array['pos_sales','inventory','categories','shifts','sales_reports','price_tiers','credit_customers','multi_warehouse'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['أسمنت','حديد','رمل وزلط','طوب','سيراميك'], 63,
 '{"items":"الأصناف","customers":"العملاء","stock":"البضاعة"}'::jsonb),

('car_parts', 'قطع غيار سيارات', '🚗',
 'قطع غيار - أرقام كتير وموديلات كتير',
 array['pos_sales','inventory','categories','shifts','sales_reports','price_tiers','credit_customers'],
 'retail', array['قطاعي','نص جملة','جملة'],
 array['قطع محرك','فرامل','كهرباء','زيوت وفلاتر','إكسسوارات'], 64,
 '{"items":"القطع","customers":"العملاء","stock":"البضاعة"}'::jsonb),

('car_service', 'مركز خدمة سيارات', '🛠️',
 'تغيير زيت وصيانة - أمر شغل لكل عربية',
 array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['زيوت وفلاتر','مصنعية','قطع غيار','غسيل'], 65,
 '{"items":"قطع وخدمات","sale":"أمر شغل","customers":"العملاء"}'::jsonb),

('printing', 'مطبعة / سنتر طباعة', '🖨️',
 'طباعة وتصوير ودعاية - شغل بالطلب',
 array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['طباعة','تصوير','دعاية','خامات'], 66,
 '{"items":"الخدمات","sale":"أمر شغل","customers":"العملاء"}'::jsonb),

('tailor', 'ترزي / أتيليه', '🧵',
 'تفصيل وتعديل - شغل بالقطعة',
 array['pos_sales','categories','shifts','sales_reports','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['تفصيل','تعديل','خامات'], 67,
 '{"items":"الخدمات","sale":"أمر شغل","customers":"العملاء"}'::jsonb),

-- ===== خدمات =====
('laundry', 'مغسلة / دراي كلين', '🧺',
 'غسيل وكي - استلام وتسليم',
 array['pos_sales','categories','shifts','sales_reports','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['غسيل','كي','دراي كلين','سجاد'], 71,
 '{"items":"الخدمات","sale":"أمر شغل","customers":"العملاء"}'::jsonb),

('gym', 'جيم / نادي', '🏋️',
 'اشتراكات وتدريب ومكملات',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['اشتراكات','تدريب خاص','مكملات','مشروبات'], 72,
 '{"items":"الاشتراكات","sale":"اشتراك","customers":"الأعضاء"}'::jsonb),

('clinic', 'عيادة', '🩺',
 'كشف ومتابعة - حساب لكل مريض',
 array['pos_sales','categories','shifts','sales_reports','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['كشف','استشارة','إجراءات'], 73,
 '{"items":"الخدمات","sale":"كشف","customers":"المرضى"}'::jsonb),

('vet', 'عيادة بيطري', '🐕',
 'كشف وتطعيم وأدوية وأكل',
 array['pos_sales','inventory','categories','shifts','sales_reports','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['كشف','تطعيمات','أدوية','أكل ومستلزمات'], 74,
 '{"items":"الخدمات والأصناف","sale":"كشف","customers":"العملاء"}'::jsonb),

('nursery', 'حضانة', '🧒',
 'اشتراكات شهرية ومصاريف',
 array['pos_sales','categories','shifts','sales_reports','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['اشتراك شهري','أنشطة','وجبات'], 75,
 '{"items":"البنود","sale":"اشتراك","customers":"أولياء الأمور"}'::jsonb),

-- ===== جملة وتوزيع =====
('wholesale', 'تاجر جملة', '📦',
 'بيع بالكميات لمحلات - أسعار متدرجة وحساب مؤجل',
 array['pos_sales','inventory','categories','shifts','sales_reports','price_tiers','credit_customers','multi_warehouse','warehouse_reports'],
 'retail', array['جملة','نص جملة','قطاعي'],
 array['أصناف عامة'], 81,
 '{"items":"الأصناف","customers":"العملاء","sale":"فاتورة","stock":"البضاعة"}'::jsonb),

('distributor', 'توزيع / وكيل', '🚚',
 'توزيع على محلات بخط سير - تحصيل بعدين',
 array['pos_sales','inventory','categories','shifts','sales_reports','price_tiers','credit_customers','multi_warehouse','warehouse_reports'],
 'retail', array['جملة','نص جملة','قطاعي'],
 array['أصناف عامة'], 82,
 '{"items":"الأصناف","customers":"العملاء","sale":"فاتورة","stock":"البضاعة"}'::jsonb),

('online_store', 'متجر أونلاين', '🛍️',
 'أوردرات أونلاين وشحن',
 array['pos_sales','inventory','categories','shifts','sales_reports','discounts','credit_customers'],
 'retail', array['سعر 1','سعر 2','سعر 3'],
 array['أصناف عامة'], 83,
 '{"items":"المنتجات","sale":"أوردر","customers":"العملاء","stock":"البضاعة"}'::jsonb)

on conflict (business_type) do nothing;
