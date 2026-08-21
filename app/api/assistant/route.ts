import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { answerQuestion } from "@/services/assistant.service";
import {
  detectCommand,
  planCommand,
} from "@/services/assistantCommand.service";
import { looksLikeCommand } from "@/lib/assistant/commands";
import { spendAssistantMessage } from "@/repositories/assistantUsage.repository";
import { AllModelsExhaustedError } from "@/lib/ai";

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

  const trimmed = question.trim();

  // Charged once, up front, for every message - not only for the ones
  // that look like commands. Plain questions call the model too, and
  // the old code let them through free, so the counter never matched
  // what was actually being spent.
  const spend = await spendAssistantMessage(supabase);

  if (!spend.allowed) {
    return NextResponse.json({ error: spend.message }, { status: 429 });
  }

  try {
    // An instruction rather than a question? Work out what it would
    // do and describe it - carrying it out is a separate call the
    // owner has to make on purpose.
    if (looksLikeCommand(trimmed)) {
      {
        const command = await detectCommand(trimmed);

        if (command) {
          const planned = await planCommand(
            supabase,
            appUser.business_id,
            command
          );

          if ("error" in planned) {
            return NextResponse.json({
              answer: planned.error,
              source: "rules",
            });
          }

          // The proposal is written by the service role, so the row
          // the execute call later names cannot have been invented or
          // edited in the browser.
          const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          const { data: action, error: actionError } = await adminClient
            .from("assistant_actions")
            .insert({
              business_id: appUser.business_id,
              created_by: appUser.id,
              kind: planned.kind,
              question: trimmed,
              payload: planned.plan,
              summary: planned.summary,
              affected_count: planned.affectedCount,
            })
            .select("id")
            .single();

          if (actionError || !action) {
            console.error("assistant: proposal insert failed", actionError);

            return NextResponse.json(
              { error: "تعذر تجهيز الأمر" },
              { status: 500 }
            );
          }

          return NextResponse.json({
            answer: planned.summary,
            source: "proposal",
            remaining: spend.remaining,
            proposal: {
              actionId: action.id,
              summary: planned.summary,
              affectedCount: planned.affectedCount,
            },
          });
        }
      }
    }

    const result = await answerQuestion(
      supabase,
      appUser.business_id,
      trimmed
    );

    return NextResponse.json({ ...result, remaining: spend.remaining });
  } catch (err) {
    // Worth telling apart: "come back tomorrow" is a different
    // instruction to the shop than "something broke".
    if (err instanceof AllModelsExhaustedError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }

    console.error(err);

    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة السؤال" },
      { status: 500 }
    );
  }
}
