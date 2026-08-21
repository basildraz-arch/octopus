import { supabase } from "@/lib/supabase";

export type CartAuditAction = "add" | "remove" | "checkout" | "quote";

export type CartAuditEvent = {
  id: string;
  user_id: string;
  cart_session_id: string;
  action: CartAuditAction;
  item_name: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  sale_id: string | null;
  created_at: string;
  users: { full_name: string } | null;
};

// Fire-and-forget on purpose: an audit write must NEVER be able to
// block or fail a sale. A cashier being unable to sell because the log
// hiccuped would be a far worse bug than a missing log line - and the
// missing line is itself visible later, since a checkout with no
// matching adds looks just as odd as adds with no checkout.
//
// No .select() on the insert: employees have INSERT but not SELECT on
// this table (migration 035), so asking for the row back would fail.
export async function logCartEvent(params: {
  businessId: string;
  userId: string;
  cartSessionId: string;
  action: CartAuditAction;
  itemId?: string | null;
  itemName?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  saleId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("cart_audit_log").insert({
    business_id: params.businessId,
    user_id: params.userId,
    cart_session_id: params.cartSessionId,
    action: params.action,
    item_id: params.itemId ?? null,
    item_name: params.itemName ?? null,
    quantity: params.quantity ?? null,
    unit_price: params.unitPrice ?? null,
    line_total: params.lineTotal ?? null,
    sale_id: params.saleId ?? null,
  });

  if (error) {
    console.error("Supabase Error (cart audit):", error.message);
  }
}

export async function getCartAuditByDate(
  businessId: string,
  date: string
): Promise<CartAuditEvent[]> {
  const start = new Date(`${date}T00:00:00`).toISOString();
  const end = new Date(`${date}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from("cart_audit_log")
    .select(
      `
      id,
      user_id,
      cart_session_id,
      action,
      item_name,
      quantity,
      unit_price,
      line_total,
      sale_id,
      created_at,
      users ( full_name )
    `
    )
    .eq("business_id", businessId)
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as CartAuditEvent[];
}

export type CartSessionSummary = {
  cartSessionId: string;
  userName: string;
  openedAt: string;
  lastEventAt: string;
  addedCount: number;
  removedCount: number;
  // Value of everything that went into the cart, whether or not it
  // survived to checkout - this is the number worth eyeballing on an
  // abandoned basket.
  addedValue: number;
  completed: boolean;
  // Slips printed without a sale. Legitimate on their own; a run of
  // them from one cashier is not.
  quoteCount: number;
};

// One row per cart. `completed: false` means items were put in a
// basket that never became a sale.
export function summarizeCartSessions(
  events: CartAuditEvent[]
): CartSessionSummary[] {
  const sessions = new Map<string, CartSessionSummary>();

  for (const event of events) {
    const existing = sessions.get(event.cart_session_id);

    const summary: CartSessionSummary = existing ?? {
      cartSessionId: event.cart_session_id,
      userName: event.users?.full_name ?? "مستخدم محذوف",
      openedAt: event.created_at,
      lastEventAt: event.created_at,
      addedCount: 0,
      removedCount: 0,
      addedValue: 0,
      completed: false,
      quoteCount: 0,
    };

    summary.lastEventAt = event.created_at;

    if (event.action === "add") {
      summary.addedCount += 1;
      summary.addedValue += event.line_total ?? 0;
    }

    if (event.action === "remove") {
      summary.removedCount += 1;
    }

    if (event.action === "checkout") {
      summary.completed = true;
    }

    if (event.action === "quote") {
      summary.quoteCount += 1;
    }

    sessions.set(event.cart_session_id, summary);
  }

  return Array.from(sessions.values()).sort((a, b) =>
    b.openedAt.localeCompare(a.openedAt)
  );
}
