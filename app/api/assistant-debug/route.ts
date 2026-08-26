import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// TEMPORARY debug endpoint - diagnose why the assistant chain fails in
// production while every part works locally. Reports: env presence,
// model rows visible to the service role, today's exhaustion marks, and
// a live probe call to the first active model. Remove after diagnosis.

export async function GET(_request: NextRequest) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const report: Record<string, unknown> = {
    geminiKeyPresent: Boolean(process.env.GEMINI_API_KEY),
    geminiKeyLength: process.env.GEMINI_API_KEY?.length ?? 0,
    geminiKeyPrefix: process.env.GEMINI_API_KEY?.slice(0, 6) ?? null,
    serviceKeyPresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  const { data: models, error: modelsError } = await admin
    .from("ai_models")
    .select("id, provider, model, label, rank, active")
    .order("rank", { ascending: true });

  report.modelsError = modelsError ? String(modelsError.message) : null;
  report.models = models;

  const today = new Date().toISOString().slice(0, 10);
  const { data: spent } = await admin
    .from("ai_model_exhaustion")
    .select("model_id, reason")
    .eq("usage_date", today);
  report.exhaustedToday = spent;

  const first = (models ?? []).find((m) => m.active && m.provider === "google");
  if (first) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      report.probe = "no key";
    } else {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${first.model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: "رد بكلمة واحدة: تمام" }] },
              contents: [{ role: "user", parts: [{ text: "سلام" }] }],
            }),
          }
        );
        const bodyText = await response.text();
        report.probe = {
          status: response.status,
          bodyStart: bodyText.slice(0, 300),
        };
      } catch (err) {
        report.probe = {
          threw: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        };
      }
    }
  }

  return NextResponse.json(report);
}
