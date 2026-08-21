// تحذير مهم: الملف ده لازم يتستدعى من السيرفر بس (API routes)
// أبدًا من أي component فيه "use client" - عشان المفاتيح
// ميوصلوش لمتصفح المستخدم أبدًا.

import { askAI } from "@/lib/ai";

// Kept as the name the three assistant services already call, so the
// move from one hardcoded model to the fallback chain did not have to
// touch them. The real work - which model, and what happens when its
// free quota runs out - is in lib/ai.ts.
export async function askGemini(
  prompt: string,
  systemInstruction: string
): Promise<string> {
  const answer = await askAI(prompt, systemInstruction);

  return answer.text;
}

export { askAI, AllModelsExhaustedError } from "@/lib/ai";
