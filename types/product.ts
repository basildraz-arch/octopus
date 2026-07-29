export interface Item {
  id: string;

  business_id?: string;
  category_id?: string;

  name: string;
  barcode?: string;

  buy_price: number;
  sell_price: number;

  stock: number;
  minimum_stock: number;

  unit?: string;
  image?: string;

  sell_by_money: boolean;
  sell_by_weight: boolean;

  item_type: "product" | "service";

  has_stock: boolean;

  active: boolean;

  keywords?: string[];

  created_at?: string;
  updated_at?: string;
}

export type ItemFormData = Omit<
  Item,
  "id" | "created_at" | "updated_at"
>;