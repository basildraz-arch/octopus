// ============================================================
// اسطمبات العرض — الأداة اللي المسوّق بيبيع بيها
// ============================================================
//
// باسل: "كل مسوق ليه أكونت محدود تسويقي وعنده اسطمبات ثابتة لكل نوع
// نشاط يقدر يفرجه ليه."
//
// المسوّق واقف قدام صاحب صيدلية. أسوأ حاجة يعملها إنه يفتحله شاشة
// فيها "لاتيه" و"كابتشينو" ويقوله "تخيّل إن دي أدوية". أول ثانية
// من العرض بتحدد باقي الكلام.
//
// ------------------------------------------------------------
// ليه ده ملف بيانات، مش حسابات حقيقية في القاعدة
// ------------------------------------------------------------
//
// الحل الواضح كان: نعمل ١٠ محلات تجريبية في القاعدة والمسوّق يدخلها
// بحساب. وde كان هيجيب أربع مشاكل:
//
//   ١. محلات حقيقية في `businesses` بتظهر في كل إحصائية وتقرير
//      عند باسل، وبتخلط العدد الحقيقي بالوهمي.
//   ٢. المسوّق بيبيع فيها ويمسح ويلخبط، والمحل التاني اللي هيتعرض
//      عليه بكرة بيلاقي الشاشة مليانة زبالة.
//   ٣. المسوّق بيبقى معاه دخول لحساب حقيقي - يعني RLS بتشوفه
//      كمستخدم في محل، وde بيفتح باب كنا قافلينه.
//   ٤. النت لازم يكون شغّال والاشتراك ساري.
//
// الملف ده بيحل الأربعة: العرض **صورة**، مش حساب. مفيش كتابة، ومفيش
// صف في أي جدول، والمسوّق مايقدرش يبوّظ حاجة ولا يشوف حاجة مش بتاعته.
//
// والأرقام هنا **معقولة مش مبالغ فيها** عن قصد: كافيه بـ٤٢٠٠ ج
// في اليوم كلام يتصدّق، وكافيه بـ٥٠ ألف بيخلّي صاحب المحل يحس إن
// البرنامج بيتكلم عن محل غير محله.

export type DemoItem = {
  name: string;
  price: number;
  category: string;
};

export type DemoShop = {
  businessType: string;
  label: string;
  shopName: string;
  categories: string[];
  items: DemoItem[];

  // سلّة نموذجية للفاتورة المطبوعة.
  basket: { name: string; quantity: number; price: number }[];

  // أرقام آخر اليوم.
  day: {
    sales: number;
    invoices: number;
    expenses: number;
    topItem: string;
  };
};

export const DEMO_SHOPS: DemoShop[] = [
  {
    businessType: "coffee",
    label: "كافيه / كوفي شوب",
    shopName: "كافيه النيل",
    categories: ["مشروبات ساقعة", "مشروبات سخنة", "حلويات", "سناكس"],
    items: [
      { name: "قهوة تركي", price: 25, category: "مشروبات سخنة" },
      { name: "إسبريسو", price: 30, category: "مشروبات سخنة" },
      { name: "كابتشينو", price: 55, category: "مشروبات سخنة" },
      { name: "لاتيه", price: 60, category: "مشروبات سخنة" },
      { name: "شاي", price: 15, category: "مشروبات سخنة" },
      { name: "آيس كوفي", price: 65, category: "مشروبات ساقعة" },
      { name: "ميلك شيك", price: 70, category: "مشروبات ساقعة" },
      { name: "عصير مانجو", price: 45, category: "مشروبات ساقعة" },
      { name: "تشيز كيك", price: 75, category: "حلويات" },
      { name: "براوني", price: 55, category: "حلويات" },
      { name: "كرواسون", price: 40, category: "سناكس" },
      { name: "سندوتش تونة", price: 65, category: "سناكس" },
    ],
    basket: [
      { name: "لاتيه", quantity: 2, price: 60 },
      { name: "تشيز كيك", quantity: 1, price: 75 },
      { name: "شاي", quantity: 1, price: 15 },
    ],
    day: { sales: 4280, invoices: 96, expenses: 640, topItem: "لاتيه" },
  },

  {
    businessType: "supermarket",
    label: "سوبر ماركت / بقالة",
    shopName: "ماركت الأمانة",
    categories: ["بقالة", "ألبان", "منظفات", "مشروبات", "مجمدات"],
    items: [
      { name: "أرز ١ كيلو", price: 42, category: "بقالة" },
      { name: "زيت ١ لتر", price: 78, category: "بقالة" },
      { name: "سكر ١ كيلو", price: 38, category: "بقالة" },
      { name: "مكرونة", price: 22, category: "بقالة" },
      { name: "لبن ١ لتر", price: 45, category: "ألبان" },
      { name: "جبنة بيضا ربع", price: 35, category: "ألبان" },
      { name: "زبادي", price: 12, category: "ألبان" },
      { name: "صابون غسيل", price: 65, category: "منظفات" },
      { name: "شامبو", price: 95, category: "منظفات" },
      { name: "مياه ١.٥ لتر", price: 10, category: "مشروبات" },
      { name: "بيبسي", price: 15, category: "مشروبات" },
      { name: "بطاطس مجمدة", price: 55, category: "مجمدات" },
    ],
    basket: [
      { name: "أرز ١ كيلو", quantity: 2, price: 42 },
      { name: "زيت ١ لتر", quantity: 1, price: 78 },
      { name: "لبن ١ لتر", quantity: 2, price: 45 },
      { name: "بيبسي", quantity: 4, price: 15 },
    ],
    day: { sales: 9650, invoices: 143, expenses: 1200, topItem: "مياه ١.٥ لتر" },
  },

  {
    businessType: "pharmacy",
    label: "صيدلية",
    shopName: "صيدلية الشفاء",
    categories: ["أدوية", "مستحضرات تجميل", "مستلزمات طبية", "ألبان أطفال"],
    items: [
      { name: "بنادول ٢٤ قرص", price: 48, category: "أدوية" },
      { name: "كتافلام", price: 62, category: "أدوية" },
      { name: "أوجمنتين ١ جم", price: 145, category: "أدوية" },
      { name: "فيتامين سي", price: 85, category: "أدوية" },
      { name: "شراب كحة", price: 55, category: "أدوية" },
      { name: "كريم مرطّب", price: 175, category: "مستحضرات تجميل" },
      { name: "واقي شمس", price: 320, category: "مستحضرات تجميل" },
      { name: "شاش طبي", price: 25, category: "مستلزمات طبية" },
      { name: "ترمومتر", price: 190, category: "مستلزمات طبية" },
      { name: "جهاز ضغط", price: 1250, category: "مستلزمات طبية" },
      { name: "لبن أطفال ٤٠٠ جم", price: 240, category: "ألبان أطفال" },
      { name: "ببرونة", price: 130, category: "ألبان أطفال" },
    ],
    basket: [
      { name: "بنادول ٢٤ قرص", quantity: 1, price: 48 },
      { name: "شراب كحة", quantity: 1, price: 55 },
      { name: "فيتامين سي", quantity: 1, price: 85 },
    ],
    day: { sales: 7420, invoices: 68, expenses: 380, topItem: "بنادول ٢٤ قرص" },
  },

  {
    businessType: "restaurant",
    label: "مطعم",
    shopName: "مطعم البيت",
    categories: ["أطباق رئيسية", "مقبلات", "مشروبات", "حلويات"],
    items: [
      { name: "فراخ مشوية نص", price: 180, category: "أطباق رئيسية" },
      { name: "كفتة", price: 220, category: "أطباق رئيسية" },
      { name: "كبدة إسكندراني", price: 150, category: "أطباق رئيسية" },
      { name: "وجبة رز بلبن", price: 95, category: "أطباق رئيسية" },
      { name: "طحينة", price: 25, category: "مقبلات" },
      { name: "سلطة", price: 30, category: "مقبلات" },
      { name: "بابا غنوج", price: 35, category: "مقبلات" },
      { name: "عيش بلدي", price: 5, category: "مقبلات" },
      { name: "مياه", price: 10, category: "مشروبات" },
      { name: "كولا", price: 18, category: "مشروبات" },
      { name: "أرز بلبن", price: 45, category: "حلويات" },
      { name: "أم علي", price: 60, category: "حلويات" },
    ],
    basket: [
      { name: "فراخ مشوية نص", quantity: 1, price: 180 },
      { name: "سلطة", quantity: 1, price: 30 },
      { name: "عيش بلدي", quantity: 4, price: 5 },
      { name: "كولا", quantity: 2, price: 18 },
    ],
    day: { sales: 11300, invoices: 82, expenses: 2100, topItem: "كفتة" },
  },

  {
    businessType: "clothing",
    label: "محل ملابس",
    shopName: "بوتيك ستايل",
    categories: ["رجالي", "حريمي", "أطفال", "أحذية"],
    items: [
      { name: "تيشيرت رجالي", price: 320, category: "رجالي" },
      { name: "بنطلون جينز", price: 650, category: "رجالي" },
      { name: "قميص", price: 480, category: "رجالي" },
      { name: "فستان", price: 890, category: "حريمي" },
      { name: "بلوزة", price: 390, category: "حريمي" },
      { name: "طرحة", price: 150, category: "حريمي" },
      { name: "تيشيرت أطفال", price: 180, category: "أطفال" },
      { name: "بيجامة أطفال", price: 250, category: "أطفال" },
      { name: "كوتشي", price: 950, category: "أحذية" },
      { name: "شبشب", price: 220, category: "أحذية" },
    ],
    basket: [
      { name: "بنطلون جينز", quantity: 1, price: 650 },
      { name: "تيشيرت رجالي", quantity: 2, price: 320 },
    ],
    day: { sales: 8900, invoices: 21, expenses: 450, topItem: "تيشيرت رجالي" },
  },

  {
    businessType: "butcher",
    label: "جزارة",
    shopName: "جزارة الإخلاص",
    categories: ["لحوم", "دواجن", "مصنّعات"],
    items: [
      { name: "لحمة بتلو (كيلو)", price: 480, category: "لحوم" },
      { name: "لحمة كندوز (كيلو)", price: 420, category: "لحوم" },
      { name: "مفروم (كيلو)", price: 440, category: "لحوم" },
      { name: "كبدة (كيلو)", price: 350, category: "لحوم" },
      { name: "فراخ بلدي (كيلو)", price: 190, category: "دواجن" },
      { name: "بانيه (كيلو)", price: 280, category: "دواجن" },
      { name: "وراك (كيلو)", price: 175, category: "دواجن" },
      { name: "سجق (كيلو)", price: 300, category: "مصنّعات" },
      { name: "برجر (علبة)", price: 130, category: "مصنّعات" },
    ],
    basket: [
      { name: "لحمة كندوز (كيلو)", quantity: 1.5, price: 420 },
      { name: "فراخ بلدي (كيلو)", quantity: 2, price: 190 },
    ],
    day: { sales: 14200, invoices: 47, expenses: 900, topItem: "فراخ بلدي (كيلو)" },
  },

  {
    businessType: "bakery",
    label: "مخبز / فرن",
    shopName: "فرن الحاج",
    categories: ["عيش", "مخبوزات", "فطاير"],
    items: [
      { name: "عيش فينو", price: 3, category: "عيش" },
      { name: "عيش شامي", price: 4, category: "عيش" },
      { name: "عيش سن", price: 5, category: "عيش" },
      { name: "كيك سادة", price: 85, category: "مخبوزات" },
      { name: "بسكوت (كيلو)", price: 160, category: "مخبوزات" },
      { name: "بيتي فور (كيلو)", price: 220, category: "مخبوزات" },
      { name: "فطير مشلتت", price: 90, category: "فطاير" },
      { name: "فطير بالجبنة", price: 120, category: "فطاير" },
    ],
    basket: [
      { name: "عيش فينو", quantity: 10, price: 3 },
      { name: "فطير مشلتت", quantity: 1, price: 90 },
      { name: "بسكوت (كيلو)", quantity: 0.5, price: 160 },
    ],
    day: { sales: 5300, invoices: 210, expenses: 1400, topItem: "عيش فينو" },
  },

  {
    businessType: "barber",
    label: "كوافير / حلاق",
    shopName: "صالون الفن",
    categories: ["خدمات", "منتجات شعر", "منتجات بشرة"],
    items: [
      { name: "قص شعر", price: 120, category: "خدمات" },
      { name: "حلاقة دقن", price: 80, category: "خدمات" },
      { name: "صبغة", price: 350, category: "خدمات" },
      { name: "بروتين", price: 900, category: "خدمات" },
      { name: "حمام كريم", price: 200, category: "خدمات" },
      { name: "شامبو محترف", price: 280, category: "منتجات شعر" },
      { name: "واكس شعر", price: 190, category: "منتجات شعر" },
      { name: "كريم حلاقة", price: 110, category: "منتجات بشرة" },
    ],
    basket: [
      { name: "قص شعر", quantity: 1, price: 120 },
      { name: "حلاقة دقن", quantity: 1, price: 80 },
    ],
    day: { sales: 3450, invoices: 29, expenses: 300, topItem: "قص شعر" },
  },

  {
    businessType: "electronics",
    label: "محل إلكترونيات",
    shopName: "عالم التكنولوجيا",
    categories: ["موبايلات", "إكسسوارات", "أجهزة منزلية", "قطع غيار"],
    items: [
      { name: "موبايل متوسط", price: 8500, category: "موبايلات" },
      { name: "موبايل اقتصادي", price: 4200, category: "موبايلات" },
      { name: "سماعة بلوتوث", price: 750, category: "إكسسوارات" },
      { name: "شاحن سريع", price: 320, category: "إكسسوارات" },
      { name: "جراب", price: 150, category: "إكسسوارات" },
      { name: "اسكرين", price: 90, category: "إكسسوارات" },
      { name: "مروحة", price: 1900, category: "أجهزة منزلية" },
      { name: "خلاط", price: 2400, category: "أجهزة منزلية" },
      { name: "شاشة موبايل", price: 1100, category: "قطع غيار" },
      { name: "بطارية", price: 480, category: "قطع غيار" },
    ],
    basket: [
      { name: "موبايل اقتصادي", quantity: 1, price: 4200 },
      { name: "جراب", quantity: 1, price: 150 },
      { name: "اسكرين", quantity: 1, price: 90 },
    ],
    day: { sales: 22600, invoices: 14, expenses: 700, topItem: "شاحن سريع" },
  },

  {
    businessType: "pet_shop",
    label: "محل حيوانات أليفة",
    shopName: "بيت الحيوانات",
    categories: ["أكل", "إكسسوارات", "أدوية", "ألعاب"],
    items: [
      { name: "أكل قطط ١ كيلو", price: 280, category: "أكل" },
      { name: "أكل كلاب ٣ كيلو", price: 650, category: "أكل" },
      { name: "أكل عصافير", price: 90, category: "أكل" },
      { name: "رملة قطط", price: 220, category: "إكسسوارات" },
      { name: "قفص", price: 850, category: "إكسسوارات" },
      { name: "طوق", price: 160, category: "إكسسوارات" },
      { name: "فيتامين", price: 240, category: "أدوية" },
      { name: "علاج برغوث", price: 320, category: "أدوية" },
      { name: "لعبة فأر", price: 70, category: "ألعاب" },
    ],
    basket: [
      { name: "أكل قطط ١ كيلو", quantity: 2, price: 280 },
      { name: "رملة قطط", quantity: 1, price: 220 },
    ],
    day: { sales: 4100, invoices: 18, expenses: 250, topItem: "أكل قطط ١ كيلو" },
  },
];

export function findDemoShop(businessType: string): DemoShop {
  return (
    DEMO_SHOPS.find((shop) => shop.businessType === businessType) ??
    DEMO_SHOPS[0]
  );
}
