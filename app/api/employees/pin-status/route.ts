import { NextRequest, NextResponse } from "next/server";

import { requireBusinessOwner } from "@/lib/requireBusinessOwner";

// Which of my cashiers already have a PIN, and which are locked out.
// Returns only booleans and ids - never a hash, never a PIN.
export async function GET(request: NextRequest) {
  const auth = await requireBusinessOwner(request);

  if (!auth.ok) return auth.response;

  const { adminClient, businessId } = auth.context;

  const { data, error } = await adminClient
    .from("employee_pins")
    .select("user_id, locked_until")
    .eq("business_id", businessId);

  if (error) {
    console.error("pin-status: query failed", error);

    return NextResponse.json(
      { error: "تعذر قراءة حالة الأرقام السرية" },
      { status: 500 }
    );
  }

  const now = Date.now();

  return NextResponse.json({
    withPin: (data ?? []).map((row) => row.user_id),
    lockedOut: (data ?? [])
      .filter(
        (row) => row.locked_until && new Date(row.locked_until).getTime() > now
      )
      .map((row) => row.user_id),
  });
}
