import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { monthlyDueFor } from "@/lib/monthlyDue";

// The price is per shop now, so this can no longer be an anonymous
// GET returning one number from the environment - it has to know who
// is asking. Same computation as the settings screen and the payment
// route, so all three always agree.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser(accessToken);

  if (!authUser) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("business_id")
    .eq("auth_user_id", authUser.id)
    .single();

  if (!appUser) {
    return NextResponse.json(
      { error: "تعذر التحقق من الحساب" },
      { status: 403 }
    );
  }

  try {
    const due = await monthlyDueFor(supabase, appUser.business_id);

    return NextResponse.json({
      priceEgp: due.due,
      subtotal: due.subtotal,
      discount: due.discount,
    });
  } catch (err) {
    console.error("paymob/price: pricing failed", err);

    return NextResponse.json(
      { error: "تعذر حساب قيمة الاشتراك" },
      { status: 500 }
    );
  }
}
