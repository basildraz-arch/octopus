import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/requirePlatformAdmin";
import { shopHealth, healthScore, type HealthFlag } from "@/lib/shopHealth";

// Rolling window for the "is this shop alive" numbers. Long enough to
// tell a quiet week from an abandoned account, short enough that the
// query stays cheap as the platform grows.
const WINDOW_DAYS = 30;

export type MasterBusinessRow = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  trialEndsAt: string | null;
  subscriptionExpiresAt: string | null;
  enabledFeatures: string[];
  businessType: string;
  uiLabels: Record<string, string>;
  monthlyPrice: number | null;
  staffLimit: number;
  warehouseLimit: number;
  branchLimit: number;
  ownerName: string | null;
  ownerEmail: string | null;
  employeeCount: number;
  itemCount: number;
  salesCount: number;
  salesTotal: number;
  lastSaleAt: string | null;

  // ============================================================
  // الحوكمة
  // ============================================================
  //
  // باسل: "عايزه يبقى الأساس يقدر يشوف ويتحكم في كل حاجة."
  //
  // والحوكمة مش شاشة فيها كل الأرقام - دي محدش بيفتحها. الحوكمة إن
  // **المحل اللي فيه مشكلة يطلع لوحده فوق**.
  //
  // التنبيهات بتتحسب في `lib/shopHealth.ts` (ملف نقي) مش هنا،
  // عشان نفس القاعدة تشتغل في شاشة المحل الواحد كمان.
  lowStockCount: number;
  abandonedCarts: number;
  openShiftSince: string | null;
  health: HealthFlag[];
  healthScore: number;
};

type ShopStatRow = {
  business_id: string;
  item_count: number;
  low_stock_count: number;
  employee_count: number;
  sales_30d_count: number;
  sales_30d_total: number;
  last_sale_at: string | null;
  open_shift_since: string | null;
  abandoned_carts: number;
};

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);

  if (!auth.ok) return auth.response;

  const { adminClient } = auth.context;

  // العدّ كله بقى في القاعدة (`master_shop_stats`، ميجريشن ٠٩٨).
  //
  // قبل كده كان المسار بيجيب **كل صفوف** `items` و`sales` ويطوي
  // عليهم هنا - شغّال على ٨ محلات، وبيقع على أول محل بيبيع بجد.
  // وكمان "آخر بيعة" كانت محدودة بـ٣٠ يوم، فالمحل اللي وقف من ٤٠
  // يوم كان بيرجع بنفس شكل المحل اللي ماباعش ولا مرة.
  //
  // `users` لسه بتتجاب لأننا محتاجين **اسم وإيميل صاحب المحل**
  // مش عدده.
  const [businessesResult, usersResult, statsResult] = await Promise.all([
    adminClient
      .from("businesses")
      .select(
        "id, name, active, created_at, trial_ends_at, subscription_expires_at, enabled_features, business_type, ui_labels, monthly_price, staff_limit, warehouse_limit, branch_limit"
      )
      .order("created_at", { ascending: false }),
    adminClient.from("users").select("business_id, role, full_name, email"),
    adminClient.rpc("master_shop_stats"),
  ]);

  for (const result of [businessesResult, usersResult, statsResult]) {
    if (result.error) {
      console.error("master overview:", result.error.message);

      return NextResponse.json(
        { error: "تعذر تحميل البيانات" },
        { status: 500 }
      );
    }
  }

  const stats = new Map<string, ShopStatRow>(
    ((statsResult.data ?? []) as ShopStatRow[]).map((row) => [
      row.business_id,
      row,
    ])
  );

  const now = Date.now();

  const rows: MasterBusinessRow[] = (businessesResult.data ?? []).map(
    (business) => {
      const staff = (usersResult.data ?? []).filter(
        (u) => u.business_id === business.id
      );

      const owner = staff.find((u) => u.role === "owner");
      const stat = stats.get(business.id);

      const staffLimit = business.staff_limit ?? 2;
      const employeeCount = Number(stat?.employee_count ?? 0);
      const itemCount = Number(stat?.item_count ?? 0);
      const salesCount = Number(stat?.sales_30d_count ?? 0);
      const lastSaleAt = stat?.last_sale_at ?? null;
      const lowStockCount = Number(stat?.low_stock_count ?? 0);
      const abandonedCarts = Number(stat?.abandoned_carts ?? 0);
      const openShiftSince = stat?.open_shift_since ?? null;

      const health = shopHealth(
        {
          active: business.active,
          trialEndsAt: business.trial_ends_at,
          subscriptionExpiresAt: business.subscription_expires_at,
          itemCount,
          employeeCount,
          staffLimit,
          salesCount30d: salesCount,
          lastSaleAt,
          openShiftSince,
          lowStockCount,
          abandonedCarts7d: abandonedCarts,
        },
        now
      );

      return {
        id: business.id,
        name: business.name,
        active: business.active,
        createdAt: business.created_at,
        trialEndsAt: business.trial_ends_at,
        subscriptionExpiresAt: business.subscription_expires_at,
        enabledFeatures: business.enabled_features ?? [],
        businessType: business.business_type ?? "other",
        uiLabels: (business.ui_labels ?? {}) as Record<string, string>,
        monthlyPrice:
          business.monthly_price == null ? null : Number(business.monthly_price),
        staffLimit,
        warehouseLimit: business.warehouse_limit ?? 1,
        branchLimit: business.branch_limit ?? 1,
        ownerName: owner?.full_name ?? null,
        ownerEmail: owner?.email ?? null,
        employeeCount,
        itemCount,
        salesCount,
        salesTotal: Number(stat?.sales_30d_total ?? 0),
        lastSaleAt,
        lowStockCount,
        abandonedCarts,
        openShiftSince,
        health,
        healthScore: healthScore(health),
      };
    }
  );

  return NextResponse.json({ windowDays: WINDOW_DAYS, businesses: rows });
}
