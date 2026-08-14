export type AppMode =
  | "retail"
  | "warehouse_management";

export type FeatureKey =
  | "pos_sales"
  | "inventory"
  | "categories"
  | "shifts"
  | "sales_reports"
  | "multi_warehouse"
  | "warehouse_reports"
  | "discounts";

export type BusinessType =
  | "pet_shop"
  | "barber"
  | "restaurant"
  | "supermarket"
  | "pharmacy"
  | "workshop"
  | "electronics"
  | "clothing"
  | "general_store"
  | "other";

export interface Business {
  id: string;

  name: string;

  business_type: BusinessType;

  app_mode: AppMode;

  enabled_features: FeatureKey[];

  custom_business_type?: string;

  phone?: string;

  email?: string;

  address?: string;

  logo?: string;

  currency: string;

  language: string;

  timezone: string;

  max_discount_percent?: number | null;

  active: boolean;

  trial_end?: string;

  trial_ends_at: string;

  subscription_expires_at: string | null;

  created_at: string;

  updated_at: string;
}