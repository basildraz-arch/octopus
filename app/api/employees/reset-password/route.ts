import { NextResponse } from "next/server";

// RETIRED - replaced by PIN login.
//
// Cashiers no longer sign in with a password: the owner sets a PIN
// (/api/employees/set-pin) and /api/auth/pin-login mints the session
// server-side. The Supabase Auth password behind a cashier account is
// now random, unknown to everyone, and never typed - so resetting it
// would accomplish nothing while looking like it did something.
//
// Kept as an explicit 410 rather than silently deleted so any cached
// client or bookmark gets a clear answer instead of a 404 that reads
// like a deployment problem. Safe to delete this folder entirely.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "الطريقة دي اتلغت - الكاشير بقى يدخل برقم سري، حدّده من صفحة الموظفين",
    },
    { status: 410 }
  );
}
