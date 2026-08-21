import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/requirePlatformAdmin";
import { generateStrongPassword } from "@/lib/tempPassword";

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);

  if (!auth.ok) return auth.response;

  const { adminClient, platformAdminId } = auth.context;

  const body = await request.json().catch(() => null);
  const requestId = body?.requestId;

  if (typeof requestId !== "string") {
    return NextResponse.json({ error: "requestId مطلوب" }, { status: 400 });
  }

  const { data: pendingRequest, error: fetchError } = await adminClient
    .from("employee_approval_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !pendingRequest) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  if (pendingRequest.status !== "pending") {
    return NextResponse.json(
      { error: "الطلب ده اتراجع فيه قبل كده" },
      { status: 409 }
    );
  }

  // The cashier will never use this - they sign in with a PIN the
  // owner sets, and /api/auth/pin-login mints their session directly.
  // So it is deliberately long, random, and told to nobody.
  const authPassword = generateStrongPassword();

  // Step 1: real Supabase Auth account. email_confirm: true because
  // the generated_email is a synthetic login identifier, not a real
  // inbox - there's no confirmation email for it to ever receive.
  const { data: createdAuthUser, error: createAuthError } =
    await adminClient.auth.admin.createUser({
      email: pendingRequest.generated_email,
      password: authPassword,
      email_confirm: true,
      user_metadata: { full_name: pendingRequest.full_name },
    });

  if (createAuthError || !createdAuthUser?.user) {
    console.error("approve-employee: createUser failed", createAuthError);

    // Surface the two failures an operator can actually act on, rather
    // than a blanket 500: a login that already exists (the request row
    // outlived its auth user), and a domain Supabase Auth refuses.
    const rawMessage = createAuthError?.message ?? "";

    if (/already|exists|registered/i.test(rawMessage)) {
      return NextResponse.json(
        {
          error: `إيميل الدخول ${pendingRequest.generated_email} متسجّل قبل كده - خلي صاحب النشاط يبعت الطلب تاني باسم مختلف شوية`,
        },
        { status: 409 }
      );
    }

    if (/email/i.test(rawMessage) && /invalid|valid/i.test(rawMessage)) {
      return NextResponse.json(
        {
          error: `Supabase رفض صيغة الإيميل (${pendingRequest.generated_email}) - محتاج نغيّر EMPLOYEE_EMAIL_DOMAIN في lib/employeeEmail.ts`,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: "تعذر إنشاء حساب الدخول" },
      { status: 500 }
    );
  }

  // Step 2: the business-facing `users` row. If this fails, roll
  // back step 1 - an auth account with no `users` row attached is
  // a login nobody can ever use, and it would collide on
  // generated_email if the Owner tries again.
  const { data: newUserRow, error: insertUserError } = await adminClient
    .from("users")
    .insert({
      business_id: pendingRequest.business_id,
      auth_user_id: createdAuthUser.user.id,
      branch_id: pendingRequest.branch_id,
      full_name: pendingRequest.full_name,
      email: pendingRequest.generated_email,
      phone: pendingRequest.phone,
      role: "employee",
      // What the owner asked for when they made the request. Carried
      // over here rather than defaulted, so an approved stock keeper
      // is a stock keeper from their first login.
      staff_role: pendingRequest.staff_role ?? "cashier",
      extra_permissions: pendingRequest.extra_permissions ?? [],
    })
    .select("id")
    .single();

  if (insertUserError || !newUserRow) {
    console.error("approve-employee: users insert failed", insertUserError);

    await adminClient.auth.admin.deleteUser(createdAuthUser.user.id);

    return NextResponse.json(
      { error: "تعذر إنشاء حساب الموظف" },
      { status: 500 }
    );
  }

  // Step 3: hand the owner's chosen PIN to the live account, so an
  // approved cashier can log in immediately. Without this the account
  // exists but is unusable until someone remembers to set a PIN - the
  // dead state this whole flow was reworked to remove.
  if (pendingRequest.pin_hash) {
    const { error: pinError } = await adminClient
      .from("employee_pins")
      .upsert(
        {
          user_id: newUserRow.id,
          business_id: pendingRequest.business_id,
          pin_hash: pendingRequest.pin_hash,
          failed_attempts: 0,
          locked_until: null,
          set_by: pendingRequest.requested_by,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (pinError) {
      // Not fatal: the account is real and the owner can set a PIN
      // from their own screen. Surfaced loudly in logs because it
      // means the cashier is blocked until they do.
      console.error("approve-employee: pin copy failed", pinError);
    }
  }

  // Step 4: close out the request. The employee account is already
  // fully usable at this point regardless of whether this last
  // bookkeeping update succeeds, so a failure here is logged rather
  // than rolled back.
  const { error: updateRequestError } = await adminClient
    .from("employee_approval_requests")
    .update({
      status: "approved",
      reviewed_by: platformAdminId,
      reviewed_at: new Date().toISOString(),
      created_user_id: newUserRow.id,
      // The hash has moved to employee_pins; keeping a second copy on
      // a row the owner can read buys nothing and risks everything.
      pin_hash: null,
    })
    .eq("id", requestId);

  if (updateRequestError) {
    console.error(
      "approve-employee: request status update failed",
      updateRequestError
    );
  }

  // Close the loop with the person who asked. Without this the owner
  // has to keep checking the employees page to find out whether their
  // request went anywhere.
  await adminClient.rpc("notify", {
    p_business_id: pendingRequest.business_id,
    p_audience: "owner",
    p_kind: "employee_request_reviewed",
    p_title: `حساب ${pendingRequest.full_name} اتفعّل`,
    p_body: "يقدر يدخل دلوقتي بالرقم السري اللي إنت حددته",
    p_link: "/employees",
    p_severity: "info",
  });

  // No credential is handed back: the account exists, but it can't be
  // used until the OWNER sets a PIN for it from their own screen.
  // That keeps the cashier's credential a matter between the shop and
  // its staff, with no password travelling through the Master.
  return NextResponse.json({
    userId: newUserRow.id,
    email: pendingRequest.generated_email,
    fullName: pendingRequest.full_name,
  });
}
