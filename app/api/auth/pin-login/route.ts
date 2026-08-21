import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { verifyPin } from "@/lib/pin";
import { MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES } from "@/lib/pinRules";

// Deliberately vague: the same message for "no such cashier", "no PIN
// set" and "wrong PIN", so this endpoint can't be used to work out
// which cashiers exist or which have PINs configured.
const GENERIC_ERROR = "الرقم السري غلط";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const employeeId = body?.employeeId;
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

  if (typeof employeeId !== "string" || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: pinRow } = await adminClient
    .from("employee_pins")
    .select("user_id, pin_hash, failed_attempts, locked_until")
    .eq("user_id", employeeId)
    .maybeSingle();

  if (!pinRow) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // Lockout is checked BEFORE the hash comparison, so a locked account
  // costs an attacker a round trip and gains them nothing.
  if (pinRow.locked_until && new Date(pinRow.locked_until) > new Date()) {
    const secondsLeft = Math.ceil(
      (new Date(pinRow.locked_until).getTime() - Date.now()) / 1000
    );

    return NextResponse.json(
      {
        error: `الحساب متقفل مؤقتًا - استنى ${Math.ceil(
          secondsLeft / 60
        )} دقيقة أو كلّم صاحب النشاط`,
        lockedSeconds: secondsLeft,
      },
      { status: 429 }
    );
  }

  const { data: employee } = await adminClient
    .from("users")
    .select("id, email, active, role, business_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (
    !employee ||
    !employee.email ||
    employee.role !== "employee" ||
    !employee.active
  ) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (!verifyPin(pin, pinRow.pin_hash)) {
    const attempts = pinRow.failed_attempts + 1;

    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : null;

    await adminClient
      .from("employee_pins")
      .update({
        failed_attempts: lockedUntil ? 0 : attempts,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", employeeId);

    if (lockedUntil) {
      return NextResponse.json(
        {
          error: `غلط ${MAX_FAILED_ATTEMPTS} مرات - الحساب اتقفل ${LOCKOUT_MINUTES} دقايق`,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: GENERIC_ERROR,
        attemptsLeft: MAX_FAILED_ATTEMPTS - attempts,
      },
      { status: 401 }
    );
  }

  // Correct PIN - clear the counter.
  await adminClient
    .from("employee_pins")
    .update({
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", employeeId);

  // Mint a real Supabase session without ever knowing the account's
  // password: generateLink produces a one-time hashed token that the
  // browser immediately exchanges for a session via verifyOtp. The
  // cashier's auth password stays random and unknown to everybody,
  // which is the point - the PIN is the only credential in play.
  const { data: link, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: employee.email,
    });

  if (linkError || !link?.properties?.hashed_token) {
    console.error("pin-login: generateLink failed", linkError);

    return NextResponse.json(
      { error: "تعذر فتح الجلسة - كلّم صاحب النشاط" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    tokenHash: link.properties.hashed_token,
  });
}
