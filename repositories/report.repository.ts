import { supabase } from "@/lib/supabase";

export type ReportSummary = {
  totalSales: number;
  totalExpenses: number;
  totalCost: number;
  netProfit: number;
  saleCount: number;
  hasIncompleteCostData: boolean;
};

type SaleWithCosts = {
  id: string;
  total: number;
  sale_items: {
    cost: number | null;
    items: { item_type: string } | null;
  }[];
};

export async function getReportSummary(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<ReportSummary> {
  const start = new Date(`${startDate}T00:00:00`).toISOString();
  const end = new Date(`${endDate}T23:59:59.999`).toISOString();

  const [salesResult, expensesResult] = await Promise.all([
    supabase
      .from("sales")
      .select(
        `
        id,
        total,
        sale_items (
          cost,
          items ( item_type )
        )
      `
      )
      .eq("business_id", businessId)
      .gte("created_at", start)
      .lte("created_at", end),
    supabase
      .from("expenses")
      .select("amount")
      .eq("business_id", businessId)
      .gte("created_at", start)
      .lte("created_at", end),
  ]);

  if (salesResult.error) {
    console.error("Supabase Error:", salesResult.error.message);
  }

  if (expensesResult.error) {
    console.error("Supabase Error:", expensesResult.error.message);
  }

  const sales = (salesResult.data ?? []) as unknown as SaleWithCosts[];
  const expenses = expensesResult.data ?? [];

  let totalSales = 0;
  let totalCost = 0;
  let hasIncompleteCostData = false;

  for (const sale of sales) {
    totalSales += Number(sale.total);

    for (const line of sale.sale_items ?? []) {
      if (line.items?.item_type === "service") {
        continue;
      }

      if (line.cost === null) {
        hasIncompleteCostData = true;
      } else {
        totalCost += Number(line.cost);
      }
    }
  }

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  const netProfit = totalSales - totalCost - totalExpenses;

  return {
    totalSales,
    totalExpenses,
    totalCost,
    netProfit,
    saleCount: sales.length,
    hasIncompleteCostData,
  };
}

// ==========================================
// Per-employee performance (Kero item 2)
//
// The business-wide totals above answer "how did the shop do".
// These answer "how did each person do" - which, with separate
// cashier logins now in place, is finally a question the data can
// actually answer.
//
// Abandoned carts are included here on purpose rather than left in
// the audit screen alone: seen next to someone's sales figures, a
// lopsided count is the single most useful number an owner has.
// ==========================================

export type EmployeeReportRow = {
  userId: string;
  userName: string;
  saleCount: number;
  totalSales: number;
  totalCost: number;
  grossProfit: number;
  expensesRecorded: number;
  averageSale: number;
  abandonedCarts: number;
  // How many invoices they rang up at each price tier, in tier order.
  tierCounts: [number, number, number];
};

type SaleRow = {
  id: string;
  total: number;
  created_by: string | null;
  price_tier: number | null;
  sale_items: { cost: number | null; items: { item_type: string } | null }[];
};

export async function getEmployeeReports(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<EmployeeReportRow[]> {
  const start = new Date(`${startDate}T00:00:00`).toISOString();
  const end = new Date(`${endDate}T23:59:59.999`).toISOString();

  const [salesResult, expensesResult, staffResult, auditResult] =
    await Promise.all([
      supabase
        .from("sales")
        .select(
          `
          id,
          total,
          created_by,
          price_tier,
          sale_items (
            cost,
            items ( item_type )
          )
        `
        )
        .eq("business_id", businessId)
        .gte("created_at", start)
        .lte("created_at", end),
      supabase
        .from("expenses")
        .select("amount, created_by")
        .eq("business_id", businessId)
        .gte("created_at", start)
        .lte("created_at", end),
      supabase
        .from("users")
        .select("id, full_name")
        .eq("business_id", businessId),
      supabase
        .from("cart_audit_log")
        .select("user_id, cart_session_id, action")
        .eq("business_id", businessId)
        .gte("created_at", start)
        .lte("created_at", end),
    ]);

  for (const result of [salesResult, expensesResult, staffResult, auditResult]) {
    if (result.error) console.error("Supabase Error:", result.error.message);
  }

  const rows = new Map<string, EmployeeReportRow>();

  const ensure = (userId: string): EmployeeReportRow => {
    const existing = rows.get(userId);

    if (existing) return existing;

    const name =
      (staffResult.data ?? []).find((u) => u.id === userId)?.full_name ??
      "مستخدم محذوف";

    const created: EmployeeReportRow = {
      userId,
      userName: name,
      saleCount: 0,
      totalSales: 0,
      totalCost: 0,
      grossProfit: 0,
      expensesRecorded: 0,
      averageSale: 0,
      abandonedCarts: 0,
      tierCounts: [0, 0, 0],
    };

    rows.set(userId, created);

    return created;
  };

  for (const sale of (salesResult.data ?? []) as unknown as SaleRow[]) {
    if (!sale.created_by) continue;

    const row = ensure(sale.created_by);

    row.saleCount += 1;
    row.totalSales += Number(sale.total);

    const tierIndex = Math.min(Math.max((sale.price_tier ?? 1) - 1, 0), 2);
    row.tierCounts[tierIndex] += 1;

    for (const line of sale.sale_items ?? []) {
      // Services have no stock and therefore no cost of goods.
      if (line.items?.item_type === "service") continue;

      if (line.cost !== null) row.totalCost += Number(line.cost);
    }
  }

  for (const expense of expensesResult.data ?? []) {
    if (!expense.created_by) continue;

    ensure(expense.created_by).expensesRecorded += Number(expense.amount);
  }

  // A cart session with events but no 'checkout' never became a sale.
  const sessions = new Map<string, { userId: string; completed: boolean }>();

  for (const event of auditResult.data ?? []) {
    const existing = sessions.get(event.cart_session_id) ?? {
      userId: event.user_id,
      completed: false,
    };

    if (event.action === "checkout") existing.completed = true;

    sessions.set(event.cart_session_id, existing);
  }

  for (const session of sessions.values()) {
    if (!session.completed) ensure(session.userId).abandonedCarts += 1;
  }

  for (const row of rows.values()) {
    row.grossProfit = row.totalSales - row.totalCost;
    row.averageSale = row.saleCount ? row.totalSales / row.saleCount : 0;
  }

  return Array.from(rows.values()).sort((a, b) => b.totalSales - a.totalSales);
}
