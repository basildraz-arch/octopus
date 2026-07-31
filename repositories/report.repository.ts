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
