import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { runPlan, type CommandPlan } from "@/services/assistantCommand.service";

// The other half of "يقترح، وإنت تأكّد".
//
// Two properties make this safe, and both are structural rather than
// a matter of the model behaving:
//
//   1. Nothing here re-reads the owner's sentence. It takes an id,
//      loads the plan that was already written down and shown, and
//      runs exactly that. A different instruction cannot be smuggled
//      in at execution time.
//
//   2. The write runs on the OWNER'S OWN session. Every RLS policy
//      and column trigger that applies to them applies to this. The
//      service role appears only to close out the ledger row, which
//      is not a business record.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const actionId = body?.actionId;

  if (typeof actionId !== "string") {
    return NextResponse.json({ error: "actionId مطلوب" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
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
    .select("id, business_id, role")
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
      { error: "الأخطبوط متاح لصاحب النشاط فقط" },
      { status: 403 }
    );
  }

  // Read through the caller's own session: the assistant_actions_read
  // policy will simply not return another business's row.
  const { data: action, error: actionError } = await supabase
    .from("assistant_actions")
    .select("id, business_id, status, payload, summary")
    .eq("id", actionId)
    .single();

  if (actionError || !action) {
    return NextResponse.json({ error: "الأمر مش موجود" }, { status: 404 });
  }

  if (action.business_id !== appUser.business_id) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  if (action.status !== "proposed") {
    return NextResponse.json(
      { error: "الأمر ده اتنفذ أو اتلغى قبل كده" },
      { status: 409 }
    );
  }

  const outcome = await runPlan(
    supabase,
    appUser.business_id,
    action.payload as CommandPlan
  );

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await adminClient
    .from("assistant_actions")
    .update({
      status: outcome.status === "ok" ? "executed" : "failed",
      executed_at: new Date().toISOString(),
      error: outcome.status === "error" ? outcome.message : null,
    })
    .eq("id", action.id);

  if (outcome.status === "error") {
    return NextResponse.json({ error: outcome.message }, { status: 400 });
  }

  // Worth a notification: a change made by talking to the app should
  // still show up in the same place every other change does.
  await adminClient.rpc("notify", {
    p_business_id: appUser.business_id,
    p_audience: "owner",
    p_kind: "assistant_action",
    p_title: "الأخطبوط نفّذ أمر",
    p_body: action.summary,
    p_link: "/items",
    p_severity: "info",
  });

  return NextResponse.json({ ok: true, message: outcome.message });
}

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const actionId = body?.actionId;

  if (typeof actionId !== "string") {
    return NextResponse.json({ error: "actionId مطلوب" }, { status: 400 });
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
    .select("business_id, role")
    .eq("auth_user_id", authUser.id)
    .single();

  if (!appUser || appUser.role !== "owner") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await adminClient
    .from("assistant_actions")
    .update({ status: "cancelled" })
    .eq("id", actionId)
    .eq("business_id", appUser.business_id)
    .eq("status", "proposed");

  return NextResponse.json({ ok: true });
}
