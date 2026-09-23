import type { FeatureKey, Business } from "@/types/business";
import type { User } from "@/types/user";
import {
  permissionsOf,
  ROLE_BASE_PERMISSIONS,
  type PermissionKey,
  type StaffRole,
} from "@/lib/permissions";
import { applyLabels, resolveLabels, type UiLabels } from "@/lib/uiLabels";

// ONE description of what the app looks like, for everybody.
//
// The sidebar, the phone's bottom bar, the home-screen tiles and the
// route guard in the dashboard layout used to be four separate lists.
// Four lists means four chances to disagree - and once the platform
// admin can PREVIEW a shop's screen, a preview built from a fifth
// copy would start lying the first time somebody edited one and not
// the others.
//
// Everything below is a pure function of UiContext, which is what
// makes an honest preview possible: the preview builds a context for
// somebody else's business and runs the very same functions the real
// screens run.

export type UiContext = {
  features: FeatureKey[];
  permissions: PermissionKey[];
  isOwner: boolean;
  isPlatformAdmin: boolean;
};

export type NavItem = {
  id: string;
  title: string;
  href: string;
  icon: string;

  // Shown only if the business has at least one of these switched on.
  // Empty means "every business".
  features: FeatureKey[];

  // Shown only to someone allowed to do this.
  permission?: PermissionKey;

  // Running the business rather than working in it.
  ownerOnly?: boolean;

  masterOnly?: boolean;
};

export type TileGroup = "daily" | "management";

export type TileItem = NavItem & { group: TileGroup };

// Titles may contain {items}, {categories}, {customers}, {sale} or
// {stock} - filled in with the shop's own words for its own work.
export const PRIMARY_NAV: NavItem[] = [
  {
    id: "home",
    title: "الرئيسية",
    href: "/dashboard",
    icon: "🏠",
    features: [],
    ownerOnly: true,
  },
  {
    id: "sell",
    title: "{sale}",
    href: "/sales",
    icon: "🛒",
    features: ["pos_sales"],
    permission: "sell",
  },
  {
    id: "expenses",
    title: "مصروف",
    href: "/expenses",
    icon: "💸",
    features: ["shifts"],
    permission: "manage_expenses",
  },
  {
    id: "warehouses",
    title: "المخازن",
    href: "/warehouses",
    icon: "🏭",
    features: ["multi_warehouse"],
    permission: "transfer_stock",
  },
  {
    id: "items",
    title: "{items}",
    href: "/items",
    icon: "📦",
    features: ["inventory"],
    permission: "manage_items",
  },
  {
    id: "reports",
    title: "التقارير",
    href: "/reports",
    icon: "📊",
    features: ["sales_reports", "warehouse_reports"],
    permission: "view_reports",
  },
  {
    id: "settings",
    title: "الإعدادات",
    href: "/settings",
    icon: "⚙️",
    features: [],
    ownerOnly: true,
  },
];

// The home screen IS the navigation. Big, labelled, picture-first
// targets beat a list of text links for someone who uses this between
// customers and has never been trained on it.
export const HOME_TILES: TileItem[] = [
  {
    id: "sales-log",
    title: "سجل المبيعات",
    href: "/sales-log",
    icon: "📒",
    features: ["pos_sales"],
    permission: "sell",
    group: "daily",
  },
  {
    id: "day-close",
    title: "تقفيل الدرج",
    href: "/day-close",
    icon: "🔒",
    features: ["shifts"],
    permission: "close_day",
    group: "daily",
  },
  {
    id: "items",
    title: "{items}",
    href: "/items",
    icon: "📦",
    features: ["inventory"],
    permission: "manage_items",
    group: "daily",
  },
  {
    id: "reports",
    title: "التقارير",
    href: "/reports",
    icon: "📊",
    features: ["sales_reports", "warehouse_reports"],
    permission: "view_reports",
    group: "daily",
  },
  {
    id: "sales-audit",
    title: "سجل الفواتير",
    href: "/sales-audit",
    icon: "🛡️",
    features: ["pos_sales"],
    ownerOnly: true,
    group: "management",
  },
  {
    id: "customers",
    title: "حسابات {customers}",
    href: "/customers",
    icon: "🧾",
    features: ["credit_customers"],
    permission: "manage_customers",
    group: "management",
  },
  {
    id: "purchases",
    title: "تزويد {stock}",
    href: "/purchases",
    icon: "🚚",
    features: ["inventory"],
    permission: "receive_stock",
    group: "management",
  },
  {
    id: "warehouses",
    title: "المخازن",
    href: "/warehouses",
    icon: "🏭",
    features: ["multi_warehouse"],
    permission: "transfer_stock",
    group: "management",
  },
  {
    id: "categories",
    title: "{categories}",
    href: "/categories",
    icon: "🗂️",
    features: ["categories"],
    permission: "manage_items",
    group: "management",
  },
  // طباعة ملصقات الباركود. تبع الأصناف، فمكانها مع الإدارة مش في
  // الشريط الجانبي - مش شاشة يومية.
  {
    id: "labels",
    title: "ملصقات الباركود",
    href: "/labels",
    icon: "🏷️",
    features: ["inventory"],
    permission: "manage_items",
    group: "management",
  },
  {
    id: "employees",
    title: "الموظفين",
    href: "/employees",
    icon: "🧑‍💼",
    features: [],
    ownerOnly: true,
    group: "management",
  },
  {
    id: "settings",
    title: "الإعدادات",
    href: "/settings",
    icon: "⚙️",
    features: [],
    ownerOnly: true,
    group: "management",
  },
  {
    id: "master",
    title: "كل البيزنسات",
    href: "/master",
    icon: "🌍",
    features: [],
    masterOnly: true,
    group: "management",
  },
  {
    id: "employee-requests",
    title: "طلبات الموظفين",
    href: "/employee-requests",
    icon: "✅",
    features: [],
    masterOnly: true,
    group: "management",
  },
];

// ============================================================
// شاشات الكاشير — قايمة لوحدها عن قصد
// ============================================================
//
// أول محاولة كانت بتوري الكاشير **نفس مربعات صاحب المحل** مفلترة
// بالصلاحيات. وباسل رفضها وهو محق:
//
//   "الموظف مش هيشوف بنفس شكل الاونر، هو محتاج يشوف اللي يفيده في
//    شغله بس مش أكتر، تبع شيفته اليومي"
//
// والفلترة بالصلاحية **مش كفاية**: "سجل المبيعات" بيتفتح بصلاحية
// `sell` اللي كل كاشير معاه، فكان بيظهر له - وهو شاشة مبنية لصاحب
// المحل (فترة تواريخ مفتوحة، وأزرار إلغاء ومرتجع).
//
// الفرق مش في **مين مسموح له**، الفرق في **إيه اللي يفيده وهو واقف
// على الكاونتر**. فالقايمة دي مكتوبة من ناحيته هو.
//
// (الـRLS بتحمي البيانات على أي حال: `sales_read` بتدّي الكاشير
// بيعاته هو بس. دي مسألة **شكل** مش تسريب.)
export const POS_TILES: TileItem[] = [
  {
    id: "pos-sales-log",
    title: "فواتيري",
    href: "/sales-log",
    icon: "📒",
    features: ["pos_sales"],
    permission: "sell",
    group: "daily",
  },
  {
    id: "pos-day-close",
    title: "تقفيل الدرج",
    href: "/day-close",
    icon: "🔒",
    features: ["shifts"],
    permission: "close_day",
    group: "daily",
  },
  {
    id: "pos-purchases",
    title: "تزويد {stock}",
    href: "/purchases",
    icon: "🚚",
    features: ["inventory"],
    permission: "receive_stock",
    group: "daily",
  },
  {
    id: "pos-customers",
    title: "حسابات {customers}",
    href: "/customers",
    icon: "🧾",
    features: ["credit_customers"],
    permission: "manage_customers",
    group: "daily",
  },
  {
    id: "pos-warehouses",
    title: "نقل بضاعة",
    href: "/warehouses/transfer",
    icon: "🏭",
    features: ["multi_warehouse"],
    permission: "transfer_stock",
    group: "daily",
  },
];

// The route guard, as data. The dashboard layout reads this instead
// of keeping its own copy, so "what a cashier can open" has exactly
// one answer.
export type RouteRule = {
  prefix: string;
  feature?: FeatureKey;
  permission?: PermissionKey;
  ownerOnly?: boolean;
};

export const ROUTE_RULES: RouteRule[] = [
  { prefix: "/dashboard", ownerOnly: true },
  { prefix: "/settings", ownerOnly: true },
  { prefix: "/employees", ownerOnly: true },
  { prefix: "/employee-requests", ownerOnly: true },
  { prefix: "/import", ownerOnly: true },
  { prefix: "/sales-audit", ownerOnly: true },
  { prefix: "/subscribe", ownerOnly: true },
  { prefix: "/activity", ownerOnly: true },
  { prefix: "/master", ownerOnly: true },
  { prefix: "/day-close", feature: "shifts", permission: "close_day" },
  { prefix: "/sales-log", feature: "pos_sales", permission: "sell" },
  { prefix: "/expenses", feature: "shifts", permission: "manage_expenses" },
  { prefix: "/items", permission: "manage_items" },
  { prefix: "/categories", permission: "manage_items" },
  { prefix: "/labels", feature: "inventory", permission: "manage_items" },
  { prefix: "/reports", permission: "view_reports" },
  { prefix: "/purchases", permission: "receive_stock" },
  { prefix: "/warehouses", feature: "multi_warehouse", permission: "transfer_stock" },
  { prefix: "/customers", feature: "credit_customers", permission: "manage_customers" },
];

export function matchesPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function ruleFor(pathname: string): RouteRule | undefined {
  return ROUTE_RULES.find((rule) => matchesPath(pathname, rule.prefix));
}

// The live session's context.
export function contextFor(
  user: User | null | undefined,
  business: Business | null | undefined,
  isPlatformAdmin: boolean
): UiContext {
  return {
    features: business?.enabled_features ?? [],
    permissions: [...permissionsOf(user)],
    isOwner: user?.role === "owner",
    isPlatformAdmin,
  };
}

// Somebody else's context, built from a business row and a role - no
// session required. This is what the Master preview runs on.
export function contextForRole(
  features: FeatureKey[],
  role: "owner" | StaffRole,
  extraPermissions: PermissionKey[] = []
): UiContext {
  if (role === "owner") {
    return { features, permissions: [], isOwner: true, isPlatformAdmin: false };
  }

  return {
    features,
    permissions: [...ROLE_BASE_PERMISSIONS[role], ...extraPermissions],
    isOwner: false,
    isPlatformAdmin: false,
  };
}

export function isVisible(item: NavItem, ctx: UiContext): boolean {
  if (item.masterOnly && !ctx.isPlatformAdmin) return false;

  if (item.ownerOnly && !ctx.isOwner) return false;

  if (
    item.features.length > 0 &&
    !item.features.some((feature) => ctx.features.includes(feature))
  ) {
    return false;
  }

  // The owner is not on the permission system - they hold everything
  // by definition, exactly the way has_permission() treats them in
  // the database.
  if (!ctx.isOwner && item.permission && !ctx.permissions.includes(item.permission)) {
    return false;
  }

  return true;
}

export function canOpen(pathname: string, ctx: UiContext): boolean {
  const rule = ruleFor(pathname);

  if (!rule) return true;

  if (rule.feature && !ctx.features.includes(rule.feature)) return false;

  if (ctx.isOwner) return true;

  if (rule.ownerOnly) return false;

  if (rule.permission && !ctx.permissions.includes(rule.permission)) return false;

  return true;
}

export type ResolvedItem<T extends NavItem> = T & { text: string };

function resolveTitle<T extends NavItem>(item: T, labels: UiLabels): ResolvedItem<T> {
  return { ...item, text: applyLabels(item.title, labels) };
}

export function visibleNavItems(
  ctx: UiContext,
  labels: UiLabels,
  items: NavItem[] = PRIMARY_NAV
): ResolvedItem<NavItem>[] {
  return items
    .filter((item) => isVisible(item, ctx))
    .map((item) => resolveTitle(item, labels));
}

export function visibleTiles(
  ctx: UiContext,
  labels: UiLabels,
  group: TileGroup
): ResolvedItem<TileItem>[] {
  return HOME_TILES.filter(
    (tile) => tile.group === group && isVisible(tile, ctx)
  ).map((tile) => resolveTitle(tile, labels));
}

/** شاشات الكاشير - `POS_TILES` مش مربعات صاحب المحل. */
export function visiblePosTiles(
  ctx: UiContext,
  labels: UiLabels
): ResolvedItem<TileItem>[] {
  return POS_TILES.filter((tile) => isVisible(tile, ctx)).map((tile) =>
    resolveTitle(tile, labels)
  );
}

// Convenience for components that already hold a session.
export function labelsFor(business: Business | null | undefined): UiLabels {
  return resolveLabels(business);
}
