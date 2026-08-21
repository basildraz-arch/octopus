import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { clientKey, rateLimit } from "@/lib/rateLimit";

// One shared invite code guarded the whole signup flow, and this
// route will tell anyone who asks whether a guess is right.
// Unlimited, that is a code that can be brute-forced in seconds.
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  const limit = rateLimit(
    clientKey(request, "verify-invite"),
    MAX_ATTEMPTS,
    WINDOW_MS
  );

  if (!limit.allowed) {
    return NextResponse.json(
      { valid: false, error: "محاولات كتير - استنى شوية وجرّب تاني" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const code = body?.code;

  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ valid: false });
  }

  const trimmed = code.trim();

  // The house code still works, so signup never depends on somebody
  // having been referred.
  const expected = process.env.SIGNUP_INVITE_CODE;

  if (typeof expected === "string" && trimmed === expected) {
    return NextResponse.json({ valid: true });
  }

  // Otherwise it may be a referrer's code. The same code that opens
  // signup is the one that records who sent them - so attribution
  // needs no extra step and cannot be forgotten. Unauthenticated by
  // necessity, so it runs on the service role and answers with the
  // referrer's name and nothing else.
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: referralCode } = await adminClient
    .from("referral_codes")
    .select("code, holder_name, active")
    .eq("code", trimmed.toUpperCase())
    .eq("active", true)
    .maybeSingle();

  if (!referralCode) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    referralCode: referralCode.code,
    referredBy: referralCode.holder_name,
  });
}
