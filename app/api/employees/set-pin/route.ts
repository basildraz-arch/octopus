import { NextRequest, NextResponse } from "next/server";

import { requireBusinessOwner } from "@/lib/requireBusinessOwner";
import { hashPin } from "@/lib/pin";
import { validatePin } from "@/lib/pinRules";

export async function POST(request: NextRequest) {
  const auth = await requireBusinessOwner(request);

  if (!auth.ok) return auth.response;

  const { adminClient, businessId, ownerUserId } = auth.context;

  const body = await request.json().catch(() => null);
  const employeeId = body?.employeeId;
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

  if (typeof employeeId !== "string") {
    return NextResponse.json({ error: "employeeId مطلوب" }, { status: 400 });
  }

  const pinError = validatePin(pin);

  if (pinError) {
    return NextResponse.json({ error: pinError }, { status: 400 });
  }

  const { data: employee, error: fetchError } = await adminClient
    .from("users")
    .select("id, business_id, role, active")
    .eq("id", employeeId)
    .single();

  if (fetchError || !employee) {
    return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });
  }

  // adminClient bypasses RLS, so ownership has to be asserted here.
  // businessId comes from the caller's verified users row, never the
  // request body.
  if (employee.business_id !== businessId) {
    return NextResponse.json(
      { error: "الموظف ده مش تابع لنشاطك" },
      { status: 403 }
    );
  }

  if (employee.role !== "employee") {
    return NextResponse.json(
      { error: "الرقم السري للموظفين بس" },
      { status: 403 }
    );
  }

  // Setting a new PIN also clears any active lockout - the owner
  // standing at the till is the intended way out of "الكاشير اتقفل".
  const { error: upsertError } = await adminClient
    .from("employee_pins")
    .upsert(
      {
        user_id: employee.id,
        business_id: businessId,
        pin_hash: hashPin(pin),
        failed_attempts: 0,
        locked_until: null,
        set_by: ownerUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("set-pin: upsert failed", upsertError);

    return NextResponse.json(
      { error: "تعذر حفظ الرقم السري" },
      { status: 500 }
    );
  }

  // The PIN itself is never echoed back - the owner just typed it.
  return NextResponse.json({ ok: true });
}
