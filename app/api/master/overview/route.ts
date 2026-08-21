import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/requirePlatformAdmin";

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
};

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);

  if (!auth.ok) return auth.response;

  const { adminClient } = auth.context;

  const since = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Four wide reads and a fold, rather than a query per business:
  // this page must stay one round trip regardless of how many shops
  // exist.
  const [businessesResult, usersResult, itemsResult, salesResult] =
    await Promise.all([
      adminClient
        .from("businesses")
        .select(
          "id, name, active, created_at, trial_ends_at, subscription_expires_at, enabled_features, business_type, ui_labels, monthly_price, staff_limit, warehouse_limit, branch_limit"
        )
        .order("created_at", { ascending: false }),
      adminClient.from("users").select("business_id, role, full_name, email"),
      adminClient.from("items").select("business_id"),
      adminClient
        .from("sales")
        .select("business_id, total, created_at")
        .gte("created_at", since),
    ]);

  for (const result of [
    businessesResult,
    usersResult,
    itemsResult,
    salesResult,
  ]) {
    if (result.error) {
      console.error("master overview:", result.error.message);

      return NextResponse.json(
        { error: "تعذر تحميل البيانات" },
        { status: 500 }
      );
    }
  }

  const rows: MasterBusinessRow[] = (businessesResult.data ?? []).map(
    (business) => {
      const staff = (usersResult.data ?? []).filter(
        (u) => u.business_id === business.id
      );

      const owner = staff.find((u) => u.role === "owner");

      const sales = (salesResult.data ?? []).filter(
        (s) => s.business_id === business.id
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
        staffLimit: business.staff_limit ?? 2,
        warehouseLimit: business.warehouse_limit ?? 1,
        branchLimit: business.branch_limit ?? 1,
        ownerName: owner?.full_name ?? null,
        ownerEmail: owner?.email ?? null,
        employeeCount: staff.filter((u) => u.role === "employee").length,
        itemCount: (itemsResult.data ?? []).filter(
          (i) => i.business_id === business.id
        ).length,
        salesCount: sales.length,
        salesTotal: sales.reduce((sum, s) => sum + Number(s.total), 0),
        lastSaleAt:
          sales
            .map((s) => s.created_at)
            .sort()
            .at(-1) ?? null,
      };
    }
  );

  return NextResponse.json({ windowDays: WINDOW_DAYS, businesses: rows });
}
