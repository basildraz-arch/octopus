import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { answerQuestion } from "@/services/assistant.service";

const MAX_QUESTION_LENGTH = 500;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const question = body?.question;

  if (typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json({ error: "السؤال مطلوب" }, { status: 400 });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: "السؤال طويل جدًا" }, { status: 400 });
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
    .select("business_id, role")
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

  try {
    const result = await answerQuestion(
      supabase,
      appUser.business_id,
      question.trim()
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة السؤال" },
      { status: 500 }
    );
  }
}
