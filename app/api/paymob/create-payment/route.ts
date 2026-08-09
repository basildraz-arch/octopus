import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PAYMOB_BASE_URL = "https://accept.paymob.com";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  // Scoped to the caller's own token, so RLS resolves their own
  // business only - business_id is never taken from the request body.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !authUser) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const { data: appUser, error: userError } = await supabase
    .from("users")
    .select("business_id, full_name, email, phone, role")
    .eq("auth_user_id", authUser.id)
    .single();

  if (userError || !appUser) {
    return NextResponse.json(
      { error: "تعذر التحقق من الحساب" },
      { status: 403 }
    );
  }

  if (appUser.role !== "owner") {
    return NextResponse.json(
      { error: "الدفع متاح لصاحب النشاط فقط" },
      { status: 403 }
    );
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", appUser.business_id)
    .single();

  if (businessError || !business) {
    return NextResponse.json(
      { error: "تعذر العثور على البيزنس" },
      { status: 404 }
    );
  }

  const amountCents = Number(process.env.SUBSCRIPTION_PRICE_EGP) * 100;
  const integrationId = Number(process.env.PAYMOB_INTEGRATION_ID);

  const [firstName, ...rest] = (appUser.full_name || "Octopus").split(" ");
  const lastName = rest.join(" ") || firstName;

  const paymobResponse = await fetch(`${PAYMOB_BASE_URL}/v1/intention/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`,
    },
    body: JSON.stringify({
      amount: amountCents,
      currency: "EGP",
      payment_methods: [integrationId],
      billing_data: {
        first_name: firstName,
        last_name: lastName,
        email: appUser.email || "no-email@octopus.app",
        phone_number: appUser.phone || "+201000000000",
        apartment: "NA",
        floor: "NA",
        street: "NA",
        building: "NA",
        city: "NA",
        state: "NA",
        country: "EG",
        postal_code: "NA",
      },
      // business_id goes here so the webhook (step 4) can identify
      // which business to credit once the payment succeeds - the
      // exact field this surfaces under in the webhook payload needs
      // confirming against a real test transaction.
      special_reference: business.id,
      extras: {
        business_id: business.id,
      },
    }),
  });

  if (!paymobResponse.ok) {
    const errorBody = await paymobResponse.text();
    console.error("Paymob create-intention error:", errorBody);

    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء عملية الدفع" },
      { status: 502 }
    );
  }

  const paymobData = await paymobResponse.json();

  const paymentUrl = `${PAYMOB_BASE_URL}/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&clientSecret=${paymobData.client_secret}`;

  return NextResponse.json({ paymentUrl });
}
