import { createClient } from "@supabase/supabase-js";

// SERVER ONLY. Never import this from anything marked "use client" -
// every provider key below would end up in the shop's browser.
//
// One model used to be hardcoded here. When its free quota ran out for
// the day the assistant was dead until midnight, which is no use to
// somebody who is meant to run their shop through it.
//
// Now it walks a chain: strongest model first, and a model that reports
// its free quota exhausted is written down as spent FOR TODAY ONLY and
// skipped. Tomorrow's date has no such rows, so the chain starts from
// the top again on its own - the daily reset is the calendar, not a job
// that has to run.
//
// The chain lives in the ai_models table, so adding a provider is a row
// plus its key in the environment, not a code change.

type ModelRow = {
  id: string;
  provider: string;
  model: string;
  label: string;
};

export type AiAnswer = {
  text: string;

  /** Which model actually answered, for the assistant to show. */
  model: string;
};

/** Thrown when every model in the chain is spent for today. */
export class AllModelsExhaustedError extends Error {
  constructor() {
    super("كل الموديلات خلصت رصيدها النهاردة. جرب بكرة.");
    this.name = "AllModelsExhaustedError";
  }
}

// The model list and the "spent today" marks are platform state, not
// shop data: read and written with the service role, never with the
// caller's token.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Providers whose key is missing are skipped rather than tried and
// failed - a missing key is a configuration fact, not a quota event,
// and marking such a model "exhausted for today" would be a lie that
// outlives the moment the key gets added.
function keyFor(provider: string): string | undefined {
  switch (provider) {
    case "google":
      return process.env.GEMINI_API_KEY;
    case "groq":
      return process.env.GROQ_API_KEY;
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
    default:
      return undefined;
  }
}

// A refusal that means "you have had your free allowance", as opposed
// to a bad request or a network blip. Only these retire a model for
// the day; anything else moves on without a mark, so a transient
// failure does not cost the whole day's capacity on the best model.
function isQuotaError(status: number, body: string): boolean {
  if (status === 429) return true;

  const lowered = body.toLowerCase();

  return (
    lowered.includes("resource_exhausted") ||
    lowered.includes("quota") ||
    lowered.includes("rate limit")
  );
}

async function callGoogle(
  model: string,
  apiKey: string,
  prompt: string,
  systemInstruction: string
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    return { ok: false, status: response.status, body: await response.text() };
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== "string" || text.length === 0) {
    return { ok: false, status: 502, body: "empty response" };
  }

  return { ok: true, text };
}

// Groq and OpenRouter both speak the OpenAI chat shape, so one function
// covers them. Neither is configured today - the rows are not in
// ai_models yet - but the moment a key and a row exist this works
// without touching the chain logic.
async function callOpenAiCompatible(
  baseUrl: string,
  model: string,
  apiKey: string,
  prompt: string,
  systemInstruction: string
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    return { ok: false, status: response.status, body: await response.text() };
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (typeof text !== "string" || text.length === 0) {
    return { ok: false, status: 502, body: "empty response" };
  }

  return { ok: true, text };
}

async function callModel(
  row: ModelRow,
  apiKey: string,
  prompt: string,
  systemInstruction: string
) {
  switch (row.provider) {
    case "google":
      return callGoogle(row.model, apiKey, prompt, systemInstruction);
    case "groq":
      return callOpenAiCompatible(
        "https://api.groq.com/openai/v1",
        row.model,
        apiKey,
        prompt,
        systemInstruction
      );
    case "openrouter":
      return callOpenAiCompatible(
        "https://openrouter.ai/api/v1",
        row.model,
        apiKey,
        prompt,
        systemInstruction
      );
    default:
      return {
        ok: false as const,
        status: 501,
        body: `unknown provider ${row.provider}`,
      };
  }
}

export async function askAI(
  prompt: string,
  systemInstruction: string
): Promise<AiAnswer> {
  const admin = adminClient();

  const today = new Date().toISOString().slice(0, 10);

  const [modelsResult, spentResult] = await Promise.all([
    admin
      .from("ai_models")
      .select("id, provider, model, label")
      .eq("active", true)
      .order("rank", { ascending: true }),
    admin
      .from("ai_model_exhaustion")
      .select("model_id")
      .eq("usage_date", today),
  ]);

  const models = (modelsResult.data ?? []) as ModelRow[];

  if (models.length === 0) {
    // Better to say the chain is empty than to fail with a network
    // error from a model nobody configured.
    throw new Error("مفيش أي موديل مفعّل للمساعد");
  }

  const spent = new Set(
    (spentResult.data ?? []).map((row) => (row as { model_id: string }).model_id)
  );

  let lastError = "";

  for (const row of models) {
    if (spent.has(row.id)) continue;

    const apiKey = keyFor(row.provider);

    if (!apiKey) continue;

    let result;

    try {
      result = await callModel(row, apiKey, prompt, systemInstruction);
    } catch (err) {
      // A thrown fetch is the network, not the model. Try the next one
      // but leave this one available.
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }

    if (result.ok) {
      return { text: result.text, model: row.label };
    }

    lastError = `${row.model}: ${result.status} ${result.body.slice(0, 200)}`;

    if (isQuotaError(result.status, result.body)) {
      // Retire it for today. Conflict-tolerant because two requests can
      // hit the wall at the same moment and both try to record it.
      await admin
        .from("ai_model_exhaustion")
        .upsert(
          {
            model_id: row.id,
            usage_date: today,
            reason: result.body.slice(0, 500),
          },
          { onConflict: "model_id,usage_date", ignoreDuplicates: true }
        );

      continue;
    }

    // Not a quota problem - a bad request or a provider hiccup. Move
    // on without retiring the model.
  }

  console.error("assistant: whole model chain failed:", lastError);

  throw new AllModelsExhaustedError();
}
