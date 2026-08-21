import { supabase } from "@/lib/supabase";
import type { Customer, CustomerBalance } from "@/types/customer";
import type { SettlementMethod } from "@/types/sale";

export async function getCustomers(
  businessId: string
): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as Customer[];
}

export async function createCustomer(params: {
  businessId: string;
  name: string;
  phone?: string;
  note?: string;
}): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: params.businessId,
      name: params.name,
      phone: params.phone ?? null,
      note: params.note ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  return data as Customer;
}

export async function deactivateCustomer(customerId: string): Promise<void> {
  const { error } = await supabase
    .from("customers")
    .update({ active: false })
    .eq("id", customerId);

  if (error) throw error;
}

// Recorded against the open shift so the money lands in the right
// day's drawer count. Amount is positive for a real payment; only an
// owner can pass a negative one, and RLS enforces that (migration
// 042) rather than this function.
export async function recordPayment(params: {
  businessId: string;
  customerId: string;
  shiftId: string | null;
  amount: number;
  method: SettlementMethod;
  note?: string;
  createdBy: string;
}): Promise<void> {
  const { error } = await supabase.from("customer_payments").insert({
    business_id: params.businessId,
    customer_id: params.customerId,
    shift_id: params.shiftId,
    amount: params.amount,
    method: params.method,
    note: params.note ?? null,
    created_by: params.createdBy,
  });

  if (error) throw error;
}

export type CustomerLedgerEntry = {
  id: string;
  kind: "charge" | "payment";
  amount: number;
  createdAt: string;
  label: string;
};

// Balances are derived, never stored: a stored running total is a
// number that can drift out of step with the rows behind it, and this
// one decides how much cash someone is asked for.
export async function getCustomerBalances(
  businessId: string
): Promise<CustomerBalance[]> {
  const [customersResult, salesResult, paymentsResult] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .eq("active", true),
    supabase
      .from("sales")
      .select("customer_id, total, created_at")
      .eq("business_id", businessId)
      .eq("payment_method", "credit"),
    supabase
      .from("customer_payments")
      .select("customer_id, amount, created_at")
      .eq("business_id", businessId),
  ]);

  for (const result of [customersResult, salesResult, paymentsResult]) {
    if (result.error) console.error("Supabase Error:", result.error.message);
  }

  const balances = new Map<string, CustomerBalance>();

  for (const customer of (customersResult.data ?? []) as Customer[]) {
    balances.set(customer.id, {
      customer,
      charged: 0,
      paid: 0,
      balance: 0,
      lastActivityAt: null,
    });
  }

  const touch = (id: string, at: string) => {
    const row = balances.get(id);

    if (row && (!row.lastActivityAt || at > row.lastActivityAt)) {
      row.lastActivityAt = at;
    }
  };

  for (const sale of salesResult.data ?? []) {
    if (!sale.customer_id) continue;

    const row = balances.get(sale.customer_id);

    if (!row) continue;

    row.charged += Number(sale.total);
    touch(sale.customer_id, sale.created_at);
  }

  for (const payment of paymentsResult.data ?? []) {
    const row = balances.get(payment.customer_id);

    if (!row) continue;

    row.paid += Number(payment.amount);
    touch(payment.customer_id, payment.created_at);
  }

  for (const row of balances.values()) {
    row.balance = row.charged - row.paid;
  }

  // Whoever owes the most, first - that is who the owner chases.
  return Array.from(balances.values()).sort((a, b) => b.balance - a.balance);
}

export async function getCustomerLedger(
  customerId: string
): Promise<CustomerLedgerEntry[]> {
  const [salesResult, paymentsResult] = await Promise.all([
    supabase
      .from("sales")
      .select("id, total, created_at")
      .eq("customer_id", customerId)
      .eq("payment_method", "credit")
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_payments")
      .select("id, amount, method, note, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);

  for (const result of [salesResult, paymentsResult]) {
    if (result.error) console.error("Supabase Error:", result.error.message);
  }

  const entries: CustomerLedgerEntry[] = [];

  for (const sale of salesResult.data ?? []) {
    entries.push({
      id: sale.id,
      kind: "charge",
      amount: Number(sale.total),
      createdAt: sale.created_at,
      label: "أخد على الحساب",
    });
  }

  for (const payment of paymentsResult.data ?? []) {
    const amount = Number(payment.amount);

    entries.push({
      id: payment.id,
      kind: "payment",
      amount,
      createdAt: payment.created_at,
      label:
        amount < 0
          ? `تسوية من صاحب النشاط${payment.note ? ` - ${payment.note}` : ""}`
          : `دفع${payment.note ? ` - ${payment.note}` : ""}`,
    });
  }

  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
