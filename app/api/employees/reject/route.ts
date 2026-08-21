import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/requirePlatformAdmin";

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);

  if (!auth.ok) return auth.response;

  const { adminClient, platformAdminId } = auth.context;

  const body = await request.json().catch(() => null);
  const requestId = body?.requestId;
  const reason = typeof body?.reason === "string" ? body.reason : null;

  if (typeof requestId !== "string") {
    return NextResponse.json({ error: "requestId مطلوب" }, { status: 400 });
  }

  // .eq("status", "pending") makes this a no-op (not an overwrite)
  // if the request was already approved/rejected/cancelled by the
  // time this call lands - avoids a race between two review actions.
  const { data: updated, error } = await adminClient
    .from("employee_approval_requests")
    .update({
      status: "rejected",
      reviewed_by: platformAdminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id, business_id, full_name")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: "تعذر رفض الطلب (يمكن يكون اتراجع فيه قبل كده)" },
      { status: 409 }
    );
  }

  // A rejection that nobody is told about reads as a request that was
  // ignored.
  await adminClient.rpc("notify", {
    p_business_id: updated.business_id,
    p_audience: "owner",
    p_kind: "employee_request_reviewed",
    p_title: `طلب حساب ${updated.full_name} اترفض`,
    p_body: reason ?? "",
    p_link: "/employees",
    p_severity: "warning",
  });

  return NextResponse.json({ ok: true });
}
