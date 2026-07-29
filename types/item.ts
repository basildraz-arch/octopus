export type ItemType =
  | "product"
  | "service";

export type SaleMethod =
  | "piece"
  | "weight"
  | "money"
  | "box"
  | "carton"
  | "meter"
  | "hour"
  | "day"
  | "package";

export type UnitType =
  | "piece"
  | "gram"
  | "kilogram"
  | "liter"
  | "meter"
  | "box"
  | "carton"
  | "bottle"
  | "roll"
  | "hour"
  | "day";

export interface ItemUnit {
  unit: UnitType;

  conversion: number;

  is_default: boolean;
}

export interface Item {

  id: string;

  business_id: string;

  category_id?: string;

  name: string;

  barcode?: string;

  item_type: ItemType;

  sale_methods: SaleMethod[];

  units: ItemUnit[];

  buy_price: number;

  sell_price: number;

  stock: number;

  minimum_stock: number;

  has_stock: boolean;

  active: boolean;

  image?: string;

  keywords: string[];

  created_at: string;

  updated_at: string;
}export type ItemFormData = Omit<
  Item,
  "id" | "created_at" | "updated_at"
>;