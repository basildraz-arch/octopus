export interface FeaturePrice {
  feature_key: string;

  monthly_price: number;

  // The app itself - always on, never its own line on the bill.
  in_base: boolean;

  sort_order: number;
}

export interface PricingSettings {
  id: number;

  base_price: number;

  included_staff: number;
  extra_staff_price: number;

  included_warehouses: number;
  extra_warehouse_price: number;

  included_branches: number;
  extra_branch_price: number;

  annual_discount_percent: number;
}

export type BillLine = {
  key: string;
  label: string;
  amount: number;
  kind: "base" | "module" | "seat";
  quantity?: number;
  unitPrice?: number;
};

export type ComputedBill = {
  lines: BillLine[];
  subtotal: number;
};
