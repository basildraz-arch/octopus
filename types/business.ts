export type AppMode =
  | "retail"
  | "warehouse_management";

export type FeatureKey =
  | "credit_customers"
  | "price_tiers"
  | "english_receipt"
  | "pos_sales"
  | "inventory"
  | "categories"
  | "shifts"
  | "sales_reports"
  | "multi_warehouse"
  | "warehouse_reports"
  | "discounts";

export type BusinessType =
  | "coffee"
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

  // Nullable rather than optional: "شيل اللوجو" writes null, which is
  // a different thing from "this field was not included".
  logo?: string | null;

  currency: string;

  language: string;

  timezone: string;

  max_discount_percent?: number | null;

  // Short code used to namespace employee logins
  // (mohamed@<code>.octopus.local). Null until the first employee is
  // requested, then frozen - see migration 034.
  employee_email_code?: string | null;

  // The shop's own words for its own work: {"items":"الأكلات"}. Only
  // the keys it wanted changed are stored; the rest fall back to the
  // app's defaults at read time. Written by the platform admin only
  // (migration 056).
  ui_labels?: Record<string, string>;

  // Which plan the shop is on, and what that plan costs it. The
  // price lives here rather than only on the plan so a special deal
  // is a field on one business, not a fork of the price list.
  plan_code?: string | null;
  monthly_price?: number | null;

  // Seeded from the plan and enforced by triggers (migration 061).
  // Kept per business so raising one shop's ceiling is an edit, not
  // a new plan - and so moving to a smaller plan never drops below
  // what the shop already built.
  staff_limit: number;
  warehouse_limit: number;
  branch_limit: number;

  // Exactly three, in order: the shop's own words for its price
  // tiers, whatever the owner calls them. Highest price first.
  price_tier_labels: [string, string, string];

  // Decides the printed receipt's width and font sizing. Most small
  // shops run an 80mm thermal roll.
  receipt_paper: "thermal_58" | "thermal_80" | "a4";

  // Every completed sale prints automatically. A printed receipt in
  // the customer's hand is what makes an unrecorded sale hard.
  force_print_on_sale: boolean;

  // ============================================================
  // الضريبة — عرض على الورقة، مش رقم جديد في الحساب
  // ============================================================
  //
  // **الأسعار شاملة الضريبة.** يعني لو اللاتيه بـ٦٠ ج، الستين دي
  // فيها الضريبة أصلًا والزبون بيدفع ٦٠. الفاتورة بتفكّها لسطرين
  // (٥٢.٦٣ + ٧.٣٧) وخلاص.
  //
  // ولذلك تشغيل الضريبة **مابيغيّرش ولا رقم** في المبيعات ولا
  // التقارير ولا الأرباح - الإجمالي المسجّل هو هو. لو كانت "غير
  // شاملة" كان كل سعر في المنيو هيزيد ١٤٪، وكل تقرير هيتغيّر.
  //
  // النسبة بتتخزّن على الفاتورة نفسها وقت البيع (`sales.tax_rate`،
  // ميجريشن ٠٩٣) مش بتتقري من هنا وقت العرض: لو النسبة اتغيّرت
  // السنة الجاية، الفواتير القديمة تفضل بنسبتها.
  tax_enabled: boolean;
  tax_rate: number;
  tax_number?: string | null;

  // عدّاد أرقام الفواتير. للقراءة بس - `record_sale` هي اللي
  // بتزوّده، ومفيش grant للكتابة عليه من المتصفح.
  next_invoice_number?: number;

  active: boolean;

  trial_end?: string;

  trial_ends_at: string;

  subscription_expires_at: string | null;

  created_at: string;

  updated_at: string;
}