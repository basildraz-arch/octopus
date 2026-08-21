import type { FeatureKey } from "@/types/business";

export interface Plan {
  code: string;

  label: string;
  tagline: string;
  icon: string;

  monthly_price: number;
  annual_price: number;

  enabled_features: FeatureKey[];

  // What the shop may have without asking. Passing one of these is a
  // real refusal from the database, not a hidden button - and that
  // refusal is what turns "I need another branch" into an upgrade
  // instead of a support ticket.
  staff_limit: number;
  warehouse_limit: number;
  branch_limit: number;

  sort_order: number;
  active: boolean;
}

// What a shop is actually using of what it pays for.
export type PlanUsage = {
  staff: number;
  warehouses: number;
  branches: number;
};

export type MonthlyBill = {
  planPrice: number;
  discount: number;
  due: number;
};
