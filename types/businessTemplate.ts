import type { FeatureKey } from "@/types/business";

// The starting shape of a business of a given kind. Editable by the
// platform admin (RLS: business_templates_admin_update, migration
// 046), readable by everyone signed in because the signup wizard
// needs it.
export interface BusinessTemplate {
  business_type: string;

  label: string;

  icon: string;

  description: string;

  enabled_features: FeatureKey[];

  app_mode: "retail" | "warehouse_management";

  price_tier_labels: string[];

  receipt_paper: "thermal_58" | "thermal_80" | "a4";

  force_print_on_sale: boolean;

  // Seeded into the business at signup, then owned by the business -
  // editing a template never reaches back into a shop already running.
  ui_labels: Record<string, string>;

  // Created with the business so day one isn't an empty screen.
  default_categories: string[];

  sort_order: number;

  active: boolean;
}
