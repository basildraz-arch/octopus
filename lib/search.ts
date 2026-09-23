import type { Item } from "@/types/item";

// ============================================================
// البحث بيشوف الكود كمان، مش الاسم بس
// ============================================================
//
// أصناف كيرو ليها أرقام منيو من تلات خانات محفوظة في خانة
// الباركود (١١٨ = أمريكانو، ١٤٤ = ميلك شيك شوكولاتة)، والكاشير
// حافظها من أيام البرنامج القديم. من غير السطر ده، الرقم ده
// مابيلاقيش حاجة وهو أسرع حاجة الكاشير يقدر يكتبها.
//
// ونفس الخانة بتشيل باركود المنتج الحقيقي في السوبر ماركت - يعني
// اللي ماسكش قارئ باركود يقدر يكتب آخر أربع أرقام ويلاقي الصنف.
export function searchItems(
  items: Item[],
  search: string
) {
  const text = search.trim().toLowerCase();

  if (!text) return items;

  // ============================================================
  // التطابق التام على الكود بيكسب لوحده
  // ============================================================
  //
  // لو الكاشير كتب الكود كامل - أو قارئ باركود حقيقي كتبه بدل
  // منه - المفروض يطلع **صنف واحد**، مش قايمة فيها كل صنف اسمه
  // فيه الأرقام دي.
  //
  // من غير الشرط ده، كتابة ١٤٤ كانت ممكن ترجّع الصنف الصح ومعاه
  // صنف تاني سعره ١٤٤، والكاشير يدوس على الغلط في الزحمة.
  const exact = items.filter(
    (item) => (item.barcode ?? "").trim().toLowerCase() === text
  );

  if (exact.length > 0) return exact;

  return items.filter((item) => {
    const nameMatch = item.name
      .toLowerCase()
      .includes(text);

    const keywordMatch = item.keywords.some((keyword) =>
      keyword.toLowerCase().includes(text)
    );

    const codeMatch = (item.barcode ?? "")
      .toLowerCase()
      .includes(text);

    return nameMatch || keywordMatch || codeMatch;
  });
}
