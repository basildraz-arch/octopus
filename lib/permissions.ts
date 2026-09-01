import type { User } from "@/types/user";

// The three jobs a person actually has in a shop. Anything finer than
// this and the owner is being asked to design a permission system
// instead of run a business; anything coarser and the stock keeper
// ends up able to empty the till.
//
// The authoritative copy of all of this lives in the database
// (staff_role_permissions() and has_permission(), migration 047).
// What follows decides what a screen SHOWS. It is not what decides
// what the database ALLOWS - that check happens again server-side on
// every write, and the two are deliberately independent.
export type StaffRole = "cashier" | "stock_keeper" | "manager";

export type PermissionKey =
  | "sell"
  | "manage_expenses"
  | "manage_customers"
  | "give_discount"
  | "transfer_stock"
  | "receive_stock"
  | "manage_items"
  | "view_reports"
  | "close_day"
  | "refund_sale";

export const ROLE_BASE_PERMISSIONS: Record<StaffRole, PermissionKey[]> = {
  cashier: ["sell", "manage_expenses", "manage_customers", "give_discount"],
  stock_keeper: ["transfer_stock", "receive_stock"],
  manager: [
    "sell",
    "manage_expenses",
    "manage_customers",
    "give_discount",
    "transfer_stock",
    "receive_stock",
    "manage_items",
    "view_reports",
    "close_day",
  ],
};

export const STAFF_ROLES: StaffRole[] = ["cashier", "stock_keeper", "manager"];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  cashier: "كاشير",
  stock_keeper: "أمين مخزن",
  manager: "مدير",
};

export const STAFF_ROLE_ICONS: Record<StaffRole, string> = {
  cashier: "🧾",
  stock_keeper: "📦",
  manager: "🗝️",
};

export const STAFF_ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  cashier: "بيبيع ويسجّل مصروفات اليوم وحسابات الزباين. مش بيشوف الأرباح ولا بيعدّل الأسعار.",
  stock_keeper: "بيستلم بضاعة وينقل بين المخازن. مش بيبيع خالص.",
  manager: "بيعمل كل حاجة ماعدا الإعدادات وإضافة الموظفين - دي لصاحب النشاط بس.",
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  sell: "يبيع",
  manage_expenses: "يسجّل مصروفات",
  manage_customers: "يمسك حسابات الزباين",
  give_discount: "يدّي خصم",
  transfer_stock: "ينقل بضاعة بين المخازن",
  receive_stock: "يستلم بضاعة جديدة",
  manage_items: "يضيف ويعدّل الأصناف والأسعار",
  view_reports: "يشوف التقارير والأرباح",
  close_day: "يقفل اليوم",

  // اتنفّذت في ميجريشن ٠٨٥. **مش في أي دور** عن قصد: اللي يقدر
  // يبيع ويلغي ويشيل الفلوس مافيش حاجة بتمسكه. صاحب المحل يدّيها
  // لموظف بعينه لو واثق فيه.
  refund_sale: "يلغي فاتورة اتسجّلت غلط",
};

// Ticking one of these tops a person up without promoting them.
export const PERMISSION_ORDER: PermissionKey[] = [
  "sell",
  "manage_items",
  "view_reports",
  "close_day",
  "receive_stock",
  "transfer_stock",
  "manage_customers",
  "manage_expenses",
  "give_discount",
  "refund_sale",
];

export function permissionsOf(user: User | null | undefined): Set<PermissionKey> {
  if (!user) return new Set();

  const base = ROLE_BASE_PERMISSIONS[user.staff_role ?? "cashier"] ?? [];
  const extra = (user.extra_permissions ?? []) as PermissionKey[];

  return new Set([...base, ...extra]);
}

export function can(
  user: User | null | undefined,
  key: PermissionKey
): boolean {
  if (!user || !user.active) return false;

  // The owner of the business is not limited by staff roles.
  if (user.role === "owner") return true;

  return permissionsOf(user).has(key);
}

// Where this person lands when they open the app, and where they get
// sent back to when they reach for a page that isn't theirs.
export function homePathFor(user: User | null | undefined): string {
  if (!user) return "/login";

  if (user.role === "owner") return "/dashboard";

  if (can(user, "sell")) return "/sales";
  if (can(user, "transfer_stock") || can(user, "receive_stock")) {
    return "/warehouses";
  }

  return "/sales";
}
