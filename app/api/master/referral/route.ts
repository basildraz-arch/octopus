import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/requirePlatformAdmin";

// Short enough to say down a phone, long enough not to be guessed by
// typing. No O/0 or I/1 - a code that gets misheard costs a referral.
const CODE_PATTERN = /^[A-Z2-9]{4,12}$/;

const MAX_MONTHLY_REWARD = 5000;

type Action = "create_code" | "set_code_active" | "record_payout";

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);

  if (!auth.ok) return auth.response;

  const { adminClient, platformAdminId } = auth.context;

  const body = await request.json().catch(() => null);
  const action = body?.action as Action | undefined;

  if (action === "create_code") {
    const code = String(body?.code ?? "").trim().toUpperCase();
    const kind = body?.kind;
    const holderName = String(body?.holderName ?? "").trim();
    const businessId = body?.businessId ?? null;

    if (!CODE_PATTERN.test(code)) {
      return NextResponse.json(
        { error: "الكود لازم يكون حروف إنجليزي كبيرة وأرقام، من 4 لـ12 خانة" },
        { status: 400 }
      );
    }

    if (kind !== "customer" && kind !== "marketer") {
      return NextResponse.json({ error: "نوع المُحيل غير صالح" }, { status: 400 });
    }

    if (!holderName) {
      return NextResponse.json({ error: "اكتب اسم صاحب الكود" }, { status: 400 });
    }

    // A shop's code has to belong to a shop; a marketer's must not,
    // or the rewards have nowhere to be discounted from.
    if (kind === "customer" && typeof businessId !== "string") {
      return NextResponse.json(
        { error: "اختار المحل صاحب الكود" },
        { status: 400 }
      );
    }

    const monthlyReward = Number(body?.monthlyReward ?? 200);
    const rewardMonths = Number(body?.rewardMonths ?? 12);

    if (
      !Number.isFinite(monthlyReward) ||
      monthlyReward < 0 ||
      monthlyReward > MAX_MONTHLY_REWARD
    ) {
      return NextResponse.json(
        { error: `المكافأة الشهرية لازم تكون بين 0 و${MAX_MONTHLY_REWARD}` },
        { status: 400 }
      );
    }

    if (!Number.isInteger(rewardMonths) || rewardMonths < 1 || rewardMonths > 60) {
      return NextResponse.json(
        { error: "عدد الشهور لازم يكون بين 1 و60" },
        { status: 400 }
      );
    }

    const { error } = await adminClient.from("referral_codes").insert({
      code,
      kind,
      business_id: kind === "customer" ? businessId : null,
      holder_name: holderName,
      holder_phone: body?.holderPhone ? String(body.holderPhone).trim() : null,
      monthly_reward: monthlyReward,
      reward_months: rewardMonths,
      notes: body?.notes ? String(body.notes).trim() : null,
      created_by: platformAdminId,
    });

    if (error) {
      console.error("referral: create failed", error);

      const duplicate = error.code === "23505";

      return NextResponse.json(
        { error: duplicate ? "الكود ده مستخدم قبل كده" : "تعذر إنشاء الكود" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, code });
  }

  if (action === "set_code_active") {
    const codeId = body?.codeId;
    const active = Boolean(body?.active);

    if (typeof codeId !== "string") {
      return NextResponse.json({ error: "codeId مطلوب" }, { status: 400 });
    }

    // Stopping a code stops NEW signups attributing to it. Referrals
    // already earned keep earning - the work was done.
    const { error } = await adminClient
      .from("referral_codes")
      .update({ active })
      .eq("id", codeId);

    if (error) {
      console.error("referral: toggle failed", error);

      return NextResponse.json({ error: "تعذر التعديل" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "record_payout") {
    const codeId = body?.codeId;
    const amount = Number(body?.amount);

    if (typeof codeId !== "string") {
      return NextResponse.json({ error: "codeId مطلوب" }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "المبلغ غير صالح" }, { status: 400 });
    }

    const { error } = await adminClient.from("referral_payouts").insert({
      referral_code_id: codeId,
      amount,
      period_label: body?.periodLabel ? String(body.periodLabel).trim() : "",
      note: body?.note ? String(body.note).trim() : null,
      recorded_by: platformAdminId,
    });

    if (error) {
      console.error("referral: payout failed", error);

      return NextResponse.json({ error: "تعذر تسجيل الدفعة" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action غير معروف" }, { status: 400 });
}
