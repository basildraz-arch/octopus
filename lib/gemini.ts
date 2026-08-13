// تحذير مهم: الملف ده لازم يتستدعى من السيرفر بس (API routes)
// أبدًا من أي component فيه "use client" - عشان GEMINI_API_KEY
// ميوصلش لمتصفح المستخدم أبدًا.

const GEMINI_MODEL = "gemini-flash-latest";

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function askGemini(
  prompt: string,
  systemInstruction: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY غير موجود في إعدادات السيرفر");
  }

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`فشل الاتصال بـ Gemini: ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini رجّع رد فاضي");
  }

  return text as string;
}
