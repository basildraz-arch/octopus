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

  buy_price: number;

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
