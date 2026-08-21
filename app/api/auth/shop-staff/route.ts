import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { normalizeBusinessCode } from "@/lib/employeeEmail";
import { clientKey, rateLimit } from "@/lib/rateLimit";

// Shop codes are short and human-chosen, so they are guessable by
// design. Rate limiting turns "walk the whole code space and collect
// every shop's staff list" into something that takes far longer than
// it is worth, without getting in the way of a till that opens this
// screen a few times a day.
const MAX_LOOKUPS = 20;
const WINDOW_MS = 60_000;

// Powers the "tap your name" step of the till login screen: given a
// shop code, return that shop's active cashiers so nobody has to type
// an email address at a busy counter.
//
// This is unauthenticated by necessity - it runs before login. It
// therefore exposes first-and-last names of cashiers to anyone who
// knows (or guesses) a shop code. That is a deliberate, bounded
// trade-off: names only, no emails, no ids that unlock anything, and
// owners are never listed. Knowing a name still gets you nowhere
// without the PIN, which is rate limited separately.
export async function POST(request: NextRequest) {
  const limit = rateLimit(clientKey(request, "shop-staff"), MAX_LOOKUPS, WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "محاولات كتير - استنى شوية" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const rawCode = typeof body?.shopCode === "string" ? body.shopCode : "";
  const shopCode = normalizeBusinessCode(rawCode);

  if (!shopCode) {
    return NextResponse.json({ error: "اكتب كود المحل" }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: business } = await adminClient
    .from("businesses")
    .select("id, name")
    .eq("employee_email_code", shopCode)
    .maybeSingle();

  if (!business) {
    return NextResponse.json(
      { error: "مفيش محل بالكود ده" },
      { status: 404 }
    );
  }

  const { data: staff, error } = await adminClient
    .from("users")
    .select("id, full_name")
    .eq("business_id", business.id)
    .eq("role", "employee")
    .eq("active", true)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("shop-staff: query failed", error);

    return NextResponse.json({ error: "حصل خطأ" }, { status: 500 });
  }

  return NextResponse.json({
    businessName: business.name,
    staff: staff ?? [],
  });
}
