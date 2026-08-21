import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requirePlatformAdmin } from "@/lib/requirePlatformAdmin";

const ALLOWED_FEATURES = [
  "pos_sales",
  "inventory",
  "categories",
  "shifts",
  "sales_reports",
  "multi_warehouse",
  "warehouse_reports",
  "discounts",
  "price_tiers",
  "english_receipt",
  "credit_customers",
];

// Approving is the ONLY way a business's features, type, warehouses
// or branches change after signup. Three triggers in migration 049
// refuse those writes for anything that isn't holding the service
// role, and the service role is only reachable here - past
// requirePlatformAdmin, which re-derives admin status from the
// database rather than believing the caller.
export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);

  if (!auth.ok) return auth.response;

  const { adminClient, platformAdminId } = auth.context;

  const body = await request.json().catch(() => null);

  const requestId = body?.requestId;
  const action = body?.action;
  const reviewNote =
    typeof body?.reviewNote === "string" ? body.reviewNote.trim() : "";

  if (typeof requestId !== "string" || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "requestId و action مطلوبين" },
      { status: 400 }
    );
  }

  const { data: changeRequest, error: fetchError } = await adminClient
    .from("change_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !changeRequest) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  if (changeRequest.status !== "pending") {
    return NextResponse.json(
      { error: "الطلب اتراجع قبل كده" },
      { status: 409 }
    );
  }

  const { data: business, error: businessError } = await adminClient
    .from("businesses")
    .select("id, name, business_type, enabled_features, app_mode")
    .eq("id", changeRequest.business_id)
    .single();

  if (businessError || !business) {
    return NextResponse.json({ error: "البيزنس غير موجود" }, { status: 404 });
  }

  // Record the decision first. A logged decision that failed to apply
  // is noisy; an applied change with no record is the failure that
  // actually matters.
  const { error: logError } = await adminClient
    .from("platform_admin_actions")
    .insert({
      platform_admin_id: platformAdminId,
      business_id: business.id,
      business_name: business.name,
      action: `change_request_${action}`,
      details: {
        request_id: changeRequest.id,
        kind: changeRequest.kind,
        payload: changeRequest.payload,
        note: changeRequest.note,
        review_note: reviewNote,
      },
    });

  if (logError) {
    console.error("change-request: logging failed", logError);

    return NextResponse.json(
      { error: "تعذر تسجيل القرار - مفيش حاجة اتغيرت" },
      { status: 500 }
    );
  }

  if (action === "approve") {
    const applied = await applyChange(adminClient, business, changeRequest);

    if (!applied.ok) {
      return NextResponse.json({ error: applied.error }, { status: 400 });
    }
  }

  const { error: updateError } = await adminClient
    .from("change_requests")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      reviewed_by: platformAdminId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote || null,
    })
    .eq("id", changeRequest.id);

  if (updateError) {
    console.error("change-request: status update failed", updateError);

    return NextResponse.json(
      { error: "الطلب اتنفذ بس تعذر تحديث حالته" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

type ApplyResult = { ok: true } | { ok: false; error: string };

async function applyChange(
  adminClient: SupabaseClient,
  business: {
    id: string;
    business_type: string;
    enabled_features: string[] | null;
    app_mode: string;
  },
  changeRequest: {
    kind: string;
    payload: Record<string, unknown>;
  }
): Promise<ApplyResult> {
  const payload = changeRequest.payload ?? {};
  const current = business.enabled_features ?? [];

  if (
    changeRequest.kind === "enable_feature" ||
    changeRequest.kind === "disable_feature"
  ) {
    const feature = payload.feature;

    if (typeof feature !== "string" || !ALLOWED_FEATURES.includes(feature)) {
      return { ok: false, error: "الميزة المطلوبة غير معروفة" };
    }

    const next =
      changeRequest.kind === "enable_feature"
        ? Array.from(new Set([...current, feature]))
        : current.filter((f) => f !== feature);

    const update: Record<string, unknown> = { enabled_features: next };

    // app_mode follows multi_warehouse; leaving them out of step is
    // what produced the "warehouse dashboard on a coffee shop" bug.
    if (feature === "multi_warehouse") {
      update.app_mode = next.includes("multi_warehouse")
        ? "warehouse_management"
        : "retail";
    }

    const { error } = await adminClient
      .from("businesses")
      .update(update)
      .eq("id", business.id);

    if (error) {
      console.error("change-request: feature update failed", error);
      return { ok: false, error: "تعذر تعديل الميزات" };
    }

    return { ok: true };
  }

  if (changeRequest.kind === "change_business_type") {
    const businessType = payload.business_type;

    if (typeof businessType !== "string") {
      return { ok: false, error: "نوع النشاط غير صالح" };
    }

    const { data: template, error: templateError } = await adminClient
      .from("business_templates")
      .select("*")
      .eq("business_type", businessType)
      .single();

    if (templateError || !template) {
      return { ok: false, error: "مفيش قالب للنشاط ده" };
    }

    const templateRow = template as {
      enabled_features: string[];
      price_tier_labels: string[];
      app_mode: string;
    };

    // Union, not replace: switching type should never silently take
    // away something the shop is already using.
    const next = Array.from(
      new Set([...current, ...(templateRow.enabled_features ?? [])])
    );

    const { error } = await adminClient
      .from("businesses")
      .update({
        business_type: businessType,
        enabled_features: next,
        app_mode: next.includes("multi_warehouse")
          ? "warehouse_management"
          : templateRow.app_mode ?? "retail",
      })
      .eq("id", business.id);

    if (error) {
      console.error("change-request: business type update failed", error);
      return { ok: false, error: "تعذر تغيير نوع النشاط" };
    }

    return { ok: true };
  }

  if (
    changeRequest.kind === "add_warehouse" ||
    changeRequest.kind === "add_branch"
  ) {
    const name = payload.name;

    if (typeof name !== "string" || name.trim().length === 0) {
      return { ok: false, error: "الاسم مطلوب" };
    }

    if (changeRequest.kind === "add_warehouse") {
      // Approving IS the upgrade. The limit is enforced by a trigger
      // now (migration 061), so granting the warehouse without
      // granting the capacity would just make the insert fail.
      const { data: currentWarehouse } = await adminClient
        .from("businesses")
        .select("warehouse_limit")
        .eq("id", business.id)
        .single();

      await adminClient
        .from("businesses")
        .update({
          warehouse_limit: (currentWarehouse?.warehouse_limit ?? 1) + 1,
        })
        .eq("id", business.id);

      const { error } = await adminClient
        .from("warehouses")
        .insert({ business_id: business.id, name: name.trim() });

      if (error) {
        console.error("change-request: warehouse insert failed", error);
        return { ok: false, error: "تعذر إضافة المخزن" };
      }

      return { ok: true };
    }

    // branches.code is NOT NULL with no default, and nobody is going
    // to type one - so it is derived from how many branches the
    // business already has.
    const { data: currentBranch } = await adminClient
      .from("businesses")
      .select("branch_limit")
      .eq("id", business.id)
      .single();

    await adminClient
      .from("businesses")
      .update({ branch_limit: (currentBranch?.branch_limit ?? 1) + 1 })
      .eq("id", business.id);

    const { count } = await adminClient
      .from("branches")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);

    const { error } = await adminClient.from("branches").insert({
      business_id: business.id,
      name: name.trim(),
      code: `B${(count ?? 0) + 1}`,
    });

    if (error) {
      console.error("change-request: branch insert failed", error);
      return { ok: false, error: "تعذر إضافة الفرع" };
    }

    return { ok: true };
  }

  // 'other' is a message, not an instruction - approving it records
  // agreement and nothing else happens automatically.
  return { ok: true };
}
