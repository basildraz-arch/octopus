-- ==========================================
-- 083: الباركود يبقى unique لكل محل، مش للقاعدة كلها
--
-- المشكلة: idx_items_barcode كان unique على barcode لوحدها، يعني
-- لو محلين مختلفين سجلوا نفس الكود (زي كود داخلي بسيط "1" أو "A")
-- التاني بيقع. ظهر فعلًا: رفع ملف أصناف عند بيزنس تاني وقع بالكامل
-- برسالة "حدث خطأ" لأن أكواد الملف متسجلة باسم بيزنس تاني.
--
-- الحل: نعمل index جديد على (business_id, barcode) - نفس الكود
-- مسموح بين محلات مختلفة، وممنوع يتكرر جوه نفس المحل.
--
-- ملاحظة تشغيلية: الـindex ده partial زي القديم (where barcode is
-- not null) عشان الأصناف من غير باركود ما تتقيدش ببعضها.
-- ==========================================

drop index if exists idx_items_barcode;

create unique index if not exists idx_items_barcode_per_business
on items (business_id, barcode)
where barcode is not null;

notify pgrst, 'reload schema';
