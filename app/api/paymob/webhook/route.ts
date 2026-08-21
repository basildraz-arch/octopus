import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

import { monthlyDueFor } from "@/lib/monthlyDue";

// Exact field order Paymob uses to compute the HMAC for the
// "Transaction Processed Callback" - do not reorder or add fields.
const HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
];

function getField(obj: Record<string, unknown>, path: string) {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      obj
    );
}

function computeHmac(obj: Record<string, unknown>, secret: string) {
  const concatenated = HMAC_FIELDS.map((field) => {
    const value = getField(obj, field);
    return value === null || value === undefined ? "" : String(value);
  }).join("");

  return crypto
    .createHmac("sha512", secret)
    .update(concatenated)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const receivedHmac = url.searchParams.get("hmac");

  if (!receivedHmac) {
    return NextResponse.json({ error: "missing hmac" }, { status: 400 });
  }

  const body = await request.json();

  if (body?.type !== "TRANSACTION") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const obj = body?.obj;

  if (!obj) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const expectedHmac = computeHmac(obj, process.env.PAYMOB_HMAC_SECRET!);

  const receivedBuffer = Buffer.from(receivedHmac, "hex");
  const expectedBuffer = Buffer.from(expectedHmac, "hex");

  const isValid =
    receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

  if (!isValid) {
    console.error("Paymob webhook: HMAC mismatch");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // special_reference (set to business_id in create-payment) should
  // surface here as merchant_order_id - confirm against a real
  // Test-mode transaction before relying on this in production.
  const businessId = obj?.order?.merchant_order_id;

  if (!businessId) {
    console.error("Paymob webhook: missing merchant_order_id", obj);
    return NextResponse.json(
      { error: "missing business reference" },
      { status: 400 }
    );
  }

  const amountCents = Number(obj.amount_cents);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // What this shop actually owes, worked out the same way the charge
  // was. This used to compare against Number(SUBSCRIPTION_PRICE_EGP) -
  // one flat number for every shop - which stopped being true the
  // moment pricing went per-module (migration 062). create-payment had
  // already moved to the computed amount, so every real payment was
  // about to be filed as "failed" and no subscription would have been
  // extended. Same bug as before, second half of it.
  let expectedCents: number | null = null;

  try {
    const due = await monthlyDueFor(supabase, businessId);
    expectedCents = Math.round(due.due * 100);
  } catch (err) {
    console.error("Paymob webhook: could not price the subscription", err);
  }

  // Paid at least what is owed. Not an equality test: the shop's bill
  // can move between opening the payment page and Paymob calling back,
  // and refusing money that covers the bill helps nobody.
  const amountCovers = expectedCents !== null && amountCents >= expectedCents;

  if (expectedCents !== null && !amountCovers) {
    console.error(
      `Paymob webhook: amount ${amountCents} does not cover ${expectedCents} for business ${businessId}`
    );
  }

  const isSuccessful =
    obj.success === true &&
    obj.pending === false &&
    obj.is_refunded !== true &&
    obj.is_voided !== true &&
    amountCovers;

  const { error: insertError } = await supabase
    .from("subscription_payments")
    .insert({
      business_id: businessId,
      paymob_transaction_id: String(obj.id),
      paymob_order_id: String(obj.order?.id ?? ""),
      amount_cents: amountCents,
      currency: obj.currency ?? "EGP",
      status: isSuccessful ? "success" : "failed",
      raw_payload: obj,
    });

  if (insertError) {
    // 23505 = unique_violation on paymob_transaction_id - Paymob
    // already sent this exact transaction before, ignore quietly
    // instead of extending the subscription a second time.
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    console.error("Paymob webhook: failed to record payment", insertError);
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }

  if (isSuccessful) {
    const { data: business } = await supabase
      .from("businesses")
      .select("subscription_expires_at, active")
      .eq("id", businessId)
      .single();

    // extend from the current expiry if it's still in the future
    // (renewing early doesn't waste remaining paid days), otherwise
    // start the new month from now (paying after a lockout)
    const currentExpiry =
      business?.subscription_expires_at &&
      new Date(business.subscription_expires_at) > new Date()
        ? new Date(business.subscription_expires_at)
        : new Date();

    const newExpiry = new Date(currentExpiry);
    newExpiry.setMonth(newExpiry.getMonth() + 1);

    // Paying is how a suspended shop comes back. Since migration 065 a
    // shop with active = false can read but not write, so without this
    // line the owner would pay, watch the expiry date move, and still
    // not be able to sell - and would have to phone Basel to be let
    // back in. Extending the date and leaving the door locked is not a
    // renewal.
    await supabase
      .from("businesses")
      .update({
        subscription_expires_at: newExpiry.toISOString(),
        // When this paid period began. Only stamped when the shop was
        // actually out - renewing early continues the period that is
        // still running rather than starting a new one, which is the
        // same logic the expiry above uses.
        ...(currentExpiry <= new Date()
          ? { subscription_started_at: new Date().toISOString() }
          : {}),
        ...(business?.active === false ? { active: true } : {}),
      })
      .eq("id", businessId);
  }

  return NextResponse.json({ received: true });
}
