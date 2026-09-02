import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/requirePlatformAdmin";

// ============================================================
// حسابات المسوقين
// ============================================================
//
// المسوق كيان تالت في البرنامج، مش صاحب محل ولا موظف:
//
//   صاحب محل → عنده صف في `users` بـrole='owner'
//   موظف     → عنده صف في `users` بـrole='employee'
//   مسوّق    → **مالوش صف في `users` خالص**
//
// والتالتة دي هي التأمين نفسه. كل policy في القاعدة بتسأل
// `get_my_business_id()`، ودي بتقرا من `users` - فمسوّق مالوش صف
// هناك بترجّعله null، وكل شرط `business_id = null` بيبقى false.
// يعني المسوق **مايقدرش يقرا صف واحد** من أي جدول في أي محل، حتى
// لو كتب الاستعلام بنفسه.
//
// الباب الوحيد المفتوح ليه هو `marketer_dashboard()` (ميجريشن ٠٩٤)
// وهي بترجّع أسماء المحلات اللي جابها وحالة الدفع وبس.

// حروف كبيرة وأرقام، من غير O/0 وI/1: الكود بيتقال في التليفون.
const CODE_PATTERN = /^[A-Z2-9]{4,12}$/;

const MAX_SIGNUP_REWARD = 100000;
const MIN_PASSWORD = 8;

type Action = "create" | "set_active" | "settle" | "set_reward";

type MarketerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  active: boolean;
  created_at: string;
  referral_code_id: string;
};

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);

  if (!auth.ok) return auth.response;

  const { adminClient } = auth.context;

  const [marketersResult, codesResult, referralsResult, interestResult] =
    await Promise.all([
    adminClient
      .from("marketers")
      .select("id, full_name, phone, active, created_at, referral_code_id")
      .order("created_at", { ascending: false }),
    adminClient.from("referral_codes").select("id, code, active, signup_reward"),
    adminClient
      .from("referrals")
      .select(
        "referral_code_id, referred_business_id, created_at, qualified_at, signup_reward, signup_paid_at, businesses ( name )"
      ),

    // طلبات المجالات اللي البرنامج لسه مابيخدمهاش (ميجريشن ٠٩٩).
    // بتترجع مع المسوقين لأنها بتتسجّل منهم في الغالب، والعدد هو
    // اللي بيقرر نبني إيه بعد كده.
    adminClient
      .from("vertical_interest")
      .select("id, vertical, shop_name, phone, note, created_at, marketer_id")
      .order("created_at", { ascending: false })
      .limit(100),
    ]);

  if (marketersResult.error) {
    console.error("marketer: list failed", marketersResult.error);

    return NextResponse.json({ error: "تعذر تحميل المسوقين" }, { status: 500 });
  }

  type CodeRow = {
    id: string;
    code: string;
    active: boolean;
    signup_reward: number;
  };

  const codes = new Map<string, CodeRow>(
    ((codesResult.data ?? []) as CodeRow[]).map((code) => [code.id, code])
  );

  const referrals = (referralsResult.data ?? []) as unknown as {
    referral_code_id: string;
    created_at: string;
    qualified_at: string | null;
    signup_reward: number | null;
    signup_paid_at: string | null;
    businesses: { name: string } | null;
  }[];

  const marketers = (marketersResult.data as MarketerRow[]).map((marketer) => {
    const code = codes.get(marketer.referral_code_id);
    const rewardEach = Number(code?.signup_reward ?? 0);

    const mine = referrals.filter(
      (referral) => referral.referral_code_id === marketer.referral_code_id
    );

    // المبلغ المتجمّد على الإحالة بيغلب سعر الكود الحالي. لو باسل
    // نزّل الـ٥٠٠ لـ٣٠٠ بكرة، اللي استحق بـ٥٠٠ يفضل ٥٠٠.
    const amountOf = (referral: (typeof mine)[number]) =>
      Number(referral.signup_reward ?? rewardEach);

    const due = mine
      .filter((r) => r.qualified_at && !r.signup_paid_at)
      .reduce((sum, r) => sum + amountOf(r), 0);

    const settled = mine
      .filter((r) => r.signup_paid_at)
      .reduce((sum, r) => sum + amountOf(r), 0);

    return {
      id: marketer.id,
      fullName: marketer.full_name,
      phone: marketer.phone,
      active: marketer.active,
      createdAt: marketer.created_at,
      code: code?.code ?? "—",
      codeActive: Boolean(code?.active),
      rewardEach,
      signedUpCount: mine.length,
      paidCount: mine.filter((r) => r.qualified_at).length,
      due,
      settled,
      shops: mine
        .map((r) => ({
          name: r.businesses?.name ?? "محل محذوف",
          signedUp: r.created_at,
          paid: Boolean(r.qualified_at),
          settled: Boolean(r.signup_paid_at),
          amount: amountOf(r),
        }))
        .sort((a, b) => b.signedUp.localeCompare(a.signedUp)),
    };
  });

  return NextResponse.json({
    marketers,
    interest: interestResult.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);

  if (!auth.ok) return auth.response;

  const { adminClient, platformAdminId } = auth.context;

  const body = await request.json().catch(() => null);
  const action = body?.action as Action | undefined;

  // ------------------------------------------------------------
  // مسوّق جديد: كود + حساب دخول، في نداء واحد
  // ------------------------------------------------------------
  //
  // الاتنين بيتعملوا مع بعض عن قصد. لو اتعملوا في شاشتين، أول
  // مسوّق هيتعمل بكود ومن غير لوجين (أو العكس)، وباسل هيكتشف ده
  // وهو على التليفون معاه.
  if (action === "create") {
    const fullName = String(body?.fullName ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const code = String(body?.code ?? "").trim().toUpperCase();
    const phone = body?.phone ? String(body.phone).trim() : null;
    const signupReward = Number(body?.signupReward ?? 500);

    if (!fullName) {
      return NextResponse.json({ error: "اكتب اسم المسوّق" }, { status: 400 });
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        { error: "اكتب إيميل صحيح للمسوّق - ده اللي هيدخل بيه" },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD) {
      return NextResponse.json(
        { error: `كلمة السر لازم تكون ${MIN_PASSWORD} حروف على الأقل` },
        { status: 400 }
      );
    }

    if (!CODE_PATTERN.test(code)) {
      return NextResponse.json(
        { error: "الكود لازم يكون حروف إنجليزي كبيرة وأرقام، من 4 لـ12 خانة" },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(signupReward) ||
      signupReward < 0 ||
      signupReward > MAX_SIGNUP_REWARD
    ) {
      return NextResponse.json(
        { error: `العمولة لازم تكون بين 0 و${MAX_SIGNUP_REWARD}` },
        { status: 400 }
      );
    }

    // الكود الأول: لو اتعمل الحساب وبعدين الكود فشل، يبقى فيه
    // حساب دخول مالوش كود ومحدش هيلاقيه.
    //
    // `monthly_reward: 0` عن قصد: نظام المسوقين بقى عمولة لمرة
    // واحدة (٥٠٠ عند أول دفعة). المكافأة الشهرية فضلت في القاعدة
    // لأكواد أصحاب المحلات (`kind='customer'`) اللي بتاخد خصم على
    // فاتورتها - نظام تاني بالكامل.
    const { data: createdCode, error: codeError } = await adminClient
      .from("referral_codes")
      .insert({
        code,
        kind: "marketer",
        business_id: null,
        holder_name: fullName,
        holder_phone: phone,
        monthly_reward: 0,
        reward_months: 12,
        signup_reward: signupReward,
        notes: body?.notes ? String(body.notes).trim() : null,
        created_by: platformAdminId,
      })
      .select("id")
      .single();

    if (codeError || !createdCode) {
      console.error("marketer: code failed", codeError);

      const duplicate = codeError?.code === "23505";

      return NextResponse.json(
        { error: duplicate ? "الكود ده مستخدم قبل كده" : "تعذر إنشاء الكود" },
        { status: 400 }
      );
    }

    const { data: createdAuth, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, marketer: true },
      });

    if (authError || !createdAuth?.user) {
      console.error("marketer: createUser failed", authError);

      // الكود اتشال عشان ما يفضلش معلّق. لو الشيل نفسه فشل، باسل
      // هيلاقي كود من غير مسوّق في شاشة الإحالات - ظاهر ومفهوم،
      // مش مخفي.
      await adminClient.from("referral_codes").delete().eq("id", createdCode.id);

      const message = authError?.message ?? "";

      if (/already|exists|registered/i.test(message)) {
        return NextResponse.json(
          { error: `الإيميل ${email} متسجّل قبل كده` },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "تعذر إنشاء حساب الدخول" },
        { status: 500 }
      );
    }

    const { error: marketerError } = await adminClient.from("marketers").insert({
      auth_user_id: createdAuth.user.id,
      referral_code_id: createdCode.id,
      full_name: fullName,
      phone,
      created_by: platformAdminId,
    });

    if (marketerError) {
      console.error("marketer: insert failed", marketerError);

      await adminClient.auth.admin.deleteUser(createdAuth.user.id);
      await adminClient.from("referral_codes").delete().eq("id", createdCode.id);

      return NextResponse.json(
        { error: "تعذر ربط حساب المسوّق" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, code, email });
  }

  if (action === "set_active") {
    const marketerId = body?.marketerId;
    const active = Boolean(body?.active);

    if (typeof marketerId !== "string") {
      return NextResponse.json({ error: "marketerId مطلوب" }, { status: 400 });
    }

    const { error } = await adminClient
      .from("marketers")
      .update({ active })
      .eq("id", marketerId);

    if (error) {
      console.error("marketer: toggle failed", error);

      return NextResponse.json({ error: "تعذر التعديل" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "set_reward") {
    const marketerId = body?.marketerId;
    const signupReward = Number(body?.signupReward);

    if (typeof marketerId !== "string") {
      return NextResponse.json({ error: "marketerId مطلوب" }, { status: 400 });
    }

    if (
      !Number.isFinite(signupReward) ||
      signupReward < 0 ||
      signupReward > MAX_SIGNUP_REWARD
    ) {
      return NextResponse.json({ error: "العمولة غير صالحة" }, { status: 400 });
    }

    const { data: marketer } = await adminClient
      .from("marketers")
      .select("referral_code_id")
      .eq("id", marketerId)
      .maybeSingle();

    if (!marketer) {
      return NextResponse.json({ error: "المسوّق مش موجود" }, { status: 404 });
    }

    // السعر الجديد للمحلات الجاية بس. اللي استحق خلاص متجمّد على
    // `referrals.signup_reward` ومابيتأثرش (ميجريشن ٠٩٤).
    const { error } = await adminClient
      .from("referral_codes")
      .update({ signup_reward: signupReward })
      .eq("id", marketer.referral_code_id);

    if (error) {
      console.error("marketer: reward failed", error);

      return NextResponse.json({ error: "تعذر التعديل" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // ------------------------------------------------------------
  // صرف المستحقات
  // ------------------------------------------------------------
  //
  // الشغل كله في `settle_marketer_commissions` (ميجريشن ٠٩٤):
  // سطر في دفتر المدفوعات + ختم على كل إحالة اتصرفت + ربطهم -
  // في عملية واحدة. لو اتعملوا هنا واحد ورا التاني وقطع في النص،
  // المستحق يفضل ظاهر ويتصرف تاني.
  if (action === "settle") {
    const marketerId = body?.marketerId;

    if (typeof marketerId !== "string") {
      return NextResponse.json({ error: "marketerId مطلوب" }, { status: 400 });
    }

    const { data, error } = await adminClient.rpc(
      "settle_marketer_commissions",
      {
        p_marketer_id: marketerId,
        p_note: body?.note ? String(body.note).trim() : null,
        p_recorded_by: platformAdminId,
      }
    );

    if (error) {
      console.error("marketer: settle failed", error);

      // رسالة القاعدة عربية وموجّهة ("مفيش مستحقات دلوقتي")،
      // فبتتعرض زي ما هي بدل ما نخترع رسالة أعم منها.
      return NextResponse.json(
        { error: error.message || "تعذر صرف المستحقات" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, amount: Number(data ?? 0) });
  }

  return NextResponse.json({ error: "action غير معروف" }, { status: 400 });
}
