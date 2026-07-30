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
  const { data, error } = await supabase
    .from("sales")
    .select("total, payment_method")
    .eq("shift_id", shiftId);

  if (error) {
    console.error("Supabase Error:", error.message);
  }

  const sales = data ?? [];

  const byPaymentMethod: Record<PaymentMethod, number> = {
    cash: 0,
    vodafone_cash: 0,
    instapay: 0,
  };

  let totalSales = 0;

  for (const sale of sales) {
    const method = sale.payment_method as PaymentMethod;

    byPaymentMethod[method] += sale.total;
    totalSales += sale.total;
  }

  return {
    totalSales,
    saleCount: sales.length,
    byPaymentMethod,
    expectedCash: byPaymentMethod.cash,
  };
}
