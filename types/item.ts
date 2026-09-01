export type ItemType =
  | "product"
  | "service";

export type SaleMethod =
  | "piece"
  | "weight"
  | "money";

export interface Item {

  id: string;

  business_id: string;

  category_id?: string;

  name: string;

  barcode?: string;

  item_type: ItemType;

  sale_method: SaleMethod;

  unit: string;

  // مش موجود إلا لو اللي بيقرا معاه صلاحية. العمود نفسه ممنوع على
  // مستوى قاعدة البيانات (ميجريشن 069) وبييجي من item_costs عن طريق
  // attachCosts()، فالغياب هنا معناه "مش من حقك تشوفه" - مش صفر.
  buy_price?: number;

  // Tier 1 - the default/walk-in price. The only one a single-price
  // shop ever sets, which is why it keeps the plain name.
  sell_price: number;

  // Tiers 2 and 3, null when the shop prices everything the same.
  // Labels for all three live on the business (price_tier_labels).
  sell_price_2?: number | null;

  sell_price_3?: number | null;

  stock: number;

  minimum_stock: number;

  has_stock: boolean;

  // مكوّن: بيختفي من شاشة الكاشير (ميجريشن ٠٩١).
  //
  // البن والسكر والكوب بيتضافوا كأصناف عشان الوصفة تخصم منهم، بس
  // محدش بيبيعهم بالحبة. من غير العلامة دي كانوا هيظهروا للكاشير
  // جنب القهوة وممكن يتباعوا بالغلط.
  is_ingredient: boolean;

  active: boolean;

  image?: string;

  keywords: string[];

  created_at: string;

  updated_at: string;
}

export type ItemFormData = Omit<
  Item,
  "id" | "created_at" | "updated_at"
>;
