import { NextRequest, NextResponse } from "next/server";

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

const MAX_EXTEND_MONTHS = 12;

const ALLOWED_LABEL_KEYS = ["items", "categories", "customers", "sale", "stock"];

const MAX_LABEL_LENGTH = 24;

// The three things Master may change in someone else's business, and
// nothing beyond them. Deliberately an allow-list of named actions
// rather than a generic "update business" endpoint: a generic one
// would quietly grow into "Master can edit their prices", which is
// exactly the power this tier was scoped away from.
type Action =
  | "set_active"
  | "extend_subscription"
  | "set_features"
  | "set_business_type"
  | "set_labels"
  | "apply_template"
  | "save_as_template"
  | "set_limits";

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);

  if (!auth.ok) return auth.response;

  const { adminClient, platformAdminId } = auth.context;

  const body = await request.json().catch(() => null);

  const businessId = body?.businessId;
  const action = body?.action as Action | undefined;

  if (typeof businessId !== "string" || !action) {
    return NextResponse.json(
      { error: "businessId و action مطلوبين" },
      { status: 400 }
    );
  }

  const { data: business, error: fetchError } = await adminClient
    .from("businesses")
    .select(
      "id, name, active, subscription_expires_at, enabled_features, business_type, ui_labels, price_tier_labels, receipt_paper, force_print_on_sale, monthly_price, staff_limit, warehouse_limit, branch_limit"
    )
    .eq("id", businessId)
    .single();

  if (fetchError || !business) {
    return NextResponse.json({ error: "البيزنس غير موجود" }, { status: 404 });
  }

  // Writes to business_templates rather than to the business, so it
  // answers here and returns rather than falling through to the
  // generic update at the bottom.
  if (action === "save_as_template") {
    const businessType = body?.businessType;
    const label = body?.label;

    if (typeof businessType !== "string" || !/^[a-z_]{2,32}$/.test(businessType)) {
      return NextResponse.json(
        { error: "كود النشاط لازم يكون إنجليزي صغير من غير مسافات" },
        { status: 400 }
      );
    }

    if (typeof label !== "string" || !label.trim()) {
      return NextResponse.json({ error: "اكتب اسم القالب" }, { status: 400 });
    }

    const row = {
      business_type: businessType,
      label: label.trim(),
      icon: typeof body?.icon === "string" && body.icon ? body.icon : "🏪",
      description:
        typeof body?.description === "string" ? body.description.trim() : "",
      enabled_features: business.enabled_features ?? [],
      app_mode: (business.enabled_features ?? []).includes("multi_warehouse")
        ? "warehouse_management"
        : "retail",
      price_tier_labels: business.price_tier_labels ?? [],
      receipt_paper: business.receipt_paper ?? "thermal_80",
      force_print_on_sale: business.force_print_on_sale ?? true,
      ui_labels: business.ui_labels ?? {},
      active: true,
      updated_at: new Date().toISOString(),
    };

    const { error: logErr } = await adminClient
      .from("platform_admin_actions")
      .insert({
        platform_admin_id: platformAdminId,
        business_id: business.id,
        business_name: business.name,
        action,
        details: { business_type: businessType, label: row.label },
      });

    if (logErr) {
      console.error("master action: logging failed", logErr);

      return NextResponse.json(
        { error: "تعذر تسجيل الإجراء - مفيش حاجة اتغيرت" },
        { status: 500 }
      );
    }

    const { error: upsertError } = await adminClient
      .from("business_templates")
      .upsert(row, { onConflict: "business_type" });

    if (upsertError) {
      console.error("master action: template upsert failed", upsertError);

      return NextResponse.json({ error: "تعذر حفظ القالب" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, details: { businessType } });
  }

  let update: Record<string, unknown> = {};
  let details: Record<string, unknown> = {};

  if (action === "set_active") {
    const active = Boolean(body?.active);

    update = { active };
    details = { from: business.active, to: active };
  } else if (action === "extend_subscription") {
    const months = Number(body?.months);

    if (!Number.isInteger(months) || months < 1 || months > MAX_EXTEND_MONTHS) {
      return NextResponse.json(
        { error: `عدد الشهور لازم يكون بين 1 و${MAX_EXTEND_MONTHS}` },
        { status: 400 }
      );
    }

    // Extend from the current expiry when it is still in the future,
    // so renewing early never throws away paid days.
    const current =
      business.subscription_expires_at &&
      new Date(business.subscription_expires_at) > new Date()
        ? new Date(business.subscription_expires_at)
        : new Date();

    const next = new Date(current);
    next.setMonth(next.getMonth() + months);

    update = { subscription_expires_at: next.toISOString() };
    details = {
      from: business.subscription_expires_at,
      to: next.toISOString(),
      months,
    };
  } else if (action === "set_features") {
    const features = body?.features;

    if (
      !Array.isArray(features) ||
      features.some((f) => typeof f !== "string" || !ALLOWED_FEATURES.includes(f))
    ) {
      return NextResponse.json(
        { error: "قائمة الميزات غير صالحة" },
        { status: 400 }
      );
    }

    update = {
      enabled_features: features,
      // app_mode follows multi_warehouse - leaving the two out of
      // step is what puts a warehouse dashboard on a coffee shop.
      app_mode: features.includes("multi_warehouse")
        ? "warehouse_management"
        : "retail",
    };
    details = { from: business.enabled_features ?? [], to: features };
  } else if (action === "set_business_type") {
    const businessType = body?.businessType;

    if (typeof businessType !== "string" || !businessType) {
      return NextResponse.json(
        { error: "نوع النشاط مطلوب" },
        { status: 400 }
      );
    }

    const { data: template } = await adminClient
      .from("business_templates")
      .select("business_type")
      .eq("business_type", businessType)
      .maybeSingle();

    if (!template) {
      return NextResponse.json(
        { error: "مفيش قالب للنشاط ده" },
        { status: 400 }
      );
    }

    update = { business_type: businessType };
    details = { from: business.business_type, to: businessType };
  } else if (action === "set_labels") {
    const labels = body?.labels;

    if (typeof labels !== "object" || labels === null || Array.isArray(labels)) {
      return NextResponse.json({ error: "الأسماء غير صالحة" }, { status: 400 });
    }

    const cleaned: Record<string, string> = {};

    for (const [key, value] of Object.entries(labels)) {
      if (!ALLOWED_LABEL_KEYS.includes(key)) {
        return NextResponse.json(
          { error: `اسم غير معروف: ${key}` },
          { status: 400 }
        );
      }

      if (typeof value !== "string") {
        return NextResponse.json({ error: "الأسماء غير صالحة" }, { status: 400 });
      }

      const trimmed = value.trim();

      if (!trimmed) continue;

      if (trimmed.length > MAX_LABEL_LENGTH) {
        return NextResponse.json(
          { error: `"${trimmed}" طويل - الحد ${MAX_LABEL_LENGTH} حرف` },
          { status: 400 }
        );
      }

      cleaned[key] = trimmed;
    }

    update = { ui_labels: cleaned };
    details = { from: business.ui_labels ?? {}, to: cleaned };
  } else if (action === "apply_template") {
    const businessType = body?.businessType;

    if (typeof businessType !== "string" || !businessType) {
      return NextResponse.json({ error: "اختار القالب" }, { status: 400 });
    }

    const { data: template } = await adminClient
      .from("business_templates")
      .select("*")
      .eq("business_type", businessType)
      .maybeSingle();

    if (!template) {
      return NextResponse.json(
        { error: "مفيش قالب للنشاط ده" },
        { status: 400 }
      );
    }

    // Everything the template describes, applied at once. The shop's
    // own data - items, prices, staff, history - is never touched:
    // a template describes the SHAPE of the app, not its contents.
    update = {
      business_type: template.business_type,
      enabled_features: template.enabled_features ?? [],
      app_mode: (template.enabled_features ?? []).includes("multi_warehouse")
        ? "warehouse_management"
        : "retail",
      price_tier_labels: template.price_tier_labels ?? business.price_tier_labels,
      receipt_paper: template.receipt_paper ?? business.receipt_paper,
      force_print_on_sale:
        template.force_print_on_sale ?? business.force_print_on_sale,
      ui_labels: template.ui_labels ?? {},
    };

    details = {
      template: businessType,
      features_from: business.enabled_features ?? [],
      features_to: template.enabled_features ?? [],
      labels_from: business.ui_labels ?? {},
      labels_to: template.ui_labels ?? {},
    };
  } else if (action === "set_limits") {
    const patch: Record<string, unknown> = {};

    // monthly_price: null clears the special deal and puts the shop
    // back on the computed bill.
    if (body?.monthlyPrice === null) {
      update = { monthly_price: null };
      details = { patch: { monthly_price: null } };
    } else {

    const numbers: [string, unknown, number][] = [
      ["staff_limit", body?.staffLimit, 999],
      ["warehouse_limit", body?.warehouseLimit, 999],
      ["branch_limit", body?.branchLimit, 999],
      ["monthly_price", body?.monthlyPrice, 100000],
    ];

    for (const [column, raw, max] of numbers) {
      if (raw === undefined || raw === null || raw === "") continue;

      const value = Number(raw);

      if (!Number.isFinite(value) || value < 0 || value > max) {
        return NextResponse.json(
          { error: `قيمة غير صالحة في ${column}` },
          { status: 400 }
        );
      }

      patch[column] = column === "monthly_price" ? value : Math.round(value);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "مفيش حاجة تتغير" }, { status: 400 });
    }

    update = patch;
    details = { patch };
    }
  } else {
    return NextResponse.json({ error: "action غير معروف" }, { status: 400 });
  }

  // Log BEFORE acting. If the write then fails we are left with a
  // recorded intent that did not happen, which is noisy but honest;
  // logging afterwards risks an action that happened with no record,
  // which is the failure mode that actually matters here.
  const { error: logError } = await adminClient
    .from("platform_admin_actions")
    .insert({
      platform_admin_id: platformAdminId,
      business_id: business.id,
      business_name: business.name,
      action,
      details,
    });

  if (logError) {
    console.error("master action: logging failed", logError);

    return NextResponse.json(
      { error: "تعذر تسجيل الإجراء - مفيش حاجة اتغيرت" },
      { status: 500 }
    );
  }

  const { error: updateError } = await adminClient
    .from("businesses")
    .update(update)
    .eq("id", business.id);

  if (updateError) {
    console.error("master action: update failed", updateError);

    return NextResponse.json({ error: "تعذر تنفيذ الإجراء" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, details });
}
