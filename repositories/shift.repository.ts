import { supabase } from "@/lib/supabase";
import type { PaymentMethod } from "@/types/sale";

export type Shift = {
  id: string;
  business_id: string;
  opened_at: string;
  closed_at: string | null;
  closed_by: string | null;
  counted_cash: number | null;
  created_at: string;
  updated_at: string;
};

export type ShiftSummary = {
  totalSales: number;
  saleCount: number;
  byPaymentMethod: Record<PaymentMethod, number>;
  totalExpenses: number;
  // Money collected during this shift against earlier credit sales.
  // It is in the drawer now even though the sale happened before.
  customerPaymentsCash: number;
  customerPaymentsOther: number;
  expectedCash: number;
};

export async function getOpenShift(
  businessId: string
): Promise<Shift | null> {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("business_id", businessId)
    .is("closed_at", null)
    .maybeSingle();

  if (error) {
    console.error("Supabase Error:", error.message);
    return null;
  }

  return data as Shift | null;
}

export async function openShift(
  businessId: string
): Promise<Shift> {
  const { data, error } = await supabase
    .from("shifts")
    .insert({ business_id: businessId })
    .select()
    .single();

  if (error) throw error;

  return data as Shift;
}

export async function getOrCreateOpenShift(
  businessId: string
): Promise<Shift> {
  const existing = await getOpenShift(businessId);

  if (existing) return existing;

  return openShift(businessId);
}

export async function getLastShift(
  businessId: string
): Promise<Shift | null> {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("business_id", businessId)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Supabase Error:", error.message);
    return null;
  }

  return data as Shift | null;
}

export async function closeShift(
  shiftId: string,
  closedBy: string,
  countedCash?: number
): Promise<Shift> {
  const { data, error } = await supabase
    .from("shifts")
    .update({
      closed_at: new Date().toISOString(),
      closed_by: closedBy,
      counted_cash: countedCash ?? null,
    })
    .eq("id", shiftId)
    .select()
    .single();

  if (error) throw error;

  return data as Shift;
}

export async function reopenShift(
  shiftId: string
): Promise<Shift> {
  const { data, error } = await supabase
    .from("shifts")
    .update({
      closed_at: null,
      closed_by: null,
      counted_cash: null,
    })
    .eq("id", shiftId)
    .select()
    .single();

  if (error) throw error;

  return data as Shift;
}

export async function getShiftSummary(
  shiftId: string
): Promise<ShiftSummary> {
  const [salesResult, expensesResult, paymentsResult] = await Promise.all([
    supabase
      .from("sales")
      .select("total, payment_method")
      .eq("shift_id", shiftId),
    supabase
      .from("expenses")
      .select("amount")
      .eq("shift_id", shiftId),
    supabase
      .from("customer_payments")
      .select("amount, method")
      .eq("shift_id", shiftId),
  ]);

  for (const result of [salesResult, expensesResult, paymentsResult]) {
    if (result.error) {
      console.error("Supabase Error:", result.error.message);
    }
  }

  const sales = salesResult.data ?? [];
  const expenses = expensesResult.data ?? [];
  const payments = paymentsResult.data ?? [];

  const byPaymentMethod: Record<PaymentMethod, number> = {
    cash: 0,
    vodafone_cash: 0,
    instapay: 0,
    credit: 0,
  };

  let totalSales = 0;

  for (const sale of sales) {
    const method = sale.payment_method as PaymentMethod;

    byPaymentMethod[method] += sale.total;
    totalSales += sale.total;
  }

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  let customerPaymentsCash = 0;
  let customerPaymentsOther = 0;

  for (const payment of payments) {
    if (payment.method === "cash") customerPaymentsCash += Number(payment.amount);
    else customerPaymentsOther += Number(payment.amount);
  }

  return {
    totalSales,
    saleCount: sales.length,
    byPaymentMethod,
    totalExpenses,
    customerPaymentsCash,
    customerPaymentsOther,
    // Credit sales are excluded by construction: they never land in
    // byPaymentMethod.cash. Settlements collected today are added,
    // because that money IS in the drawer now.
    expectedCash:
      byPaymentMethod.cash + customerPaymentsCash - totalExpenses,
  };
}

// ============================================================
// شغل الكاشير هو في ورديته
// ============================================================
//
// `getShiftSummary` فوق بترجّع الوردية كلها - شغل كل اللي فيها.
// دي بترجّع **شغل اللي بينادي بس**.
//
// الفرق مش تجميلي: `view_reports` صلاحية واحدة بتفتح مبيعات المحل
// والأرباح وشغل كل زميل. فصاحب المحل كان قدامه اختيارين بس - يدّي
// الكاشير كل ده، أو مايشوفش ولا رقم عن يومه هو. والاتنين غلط:
// الكاشير محتاج يعرف باع بكام عشان يعدّ الدرج ويسلّم.
//
// الحاجز في `my_shift_report` (ميجريشن ٠٨٦) مش صلاحية - هو **محتوى
// الرد نفسه**: مفيش تكلفة ولا ربح ولا أي رقم يخص حد تاني. الأرقام
// دي هو اللي كتبها بإيده، إحنا بنجمّعها له بس.
export type MyShiftReport = {
  shiftId: string;
  openedAt: string;
  saleCount: number;
  totalSales: number;
  cashSales: number;
  otherSales: number;
  creditSales: number;
  myExpenses: number;
  expectedCash: number;
};

export async function getMyShiftReport(): Promise<MyShiftReport | null> {
  const { data, error } = await supabase.rpc("my_shift_report");

  if (error) throw new Error(error.message);

  const row = (data ?? [])[0] as Record<string, unknown> | undefined;

  // مفيش صف = مفيش وردية مفتوحة. مش خطأ.
  if (!row) return null;

  return {
    shiftId: row.shift_id as string,
    openedAt: row.opened_at as string,
    saleCount: Number(row.sale_count),
    totalSales: Number(row.total_sales),
    cashSales: Number(row.cash_sales),
    otherSales: Number(row.other_sales),
    creditSales: Number(row.credit_sales),
    myExpenses: Number(row.my_expenses),
    expectedCash: Number(row.expected_cash),
  };
}

// تسليم الوردية لزميل: قفل بجرد + فتح وردية جديدة، عملية واحدة.
//
// الاتنين لازم يحصلوا مع بعض. لو القفل نجح والفتح فشل، المحل يفضل
// من غير وردية والكاشير التاني مش هيعرف يبيع. عشان كده الشغل كله
// في `handover_shift` (ميجريشن ٠٨٧) مش هنا.
export async function handoverShift(countedCash: number): Promise<string> {
  const { data, error } = await supabase.rpc("handover_shift", {
    p_counted_cash: countedCash,
  });

  if (error) throw new Error(error.message);

  return data as string;
}
