// Full simulation of the freeform path against prod, with a REAL user token.
// We don't have one here... BUT we can test askAI directly (no auth needed - service role).
require('dotenv').config({ path: 'C:/Users/LOGO/Desktop/octopus/.env.local' });
const path = require('path');
// transpile-free: use tsx? Not installed. Instead replicate callModel logic inline:
const KEY = process.env.GEMINI_API_KEY;

async function callGoogle(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: "انت مساعد. جاوب بالعامية المصرية." }] },
      contents: [{ role: "user", parts: [{ text: "ايه الاخبار؟" }] }],
    }),
  });
  if (!response.ok) {
    return { ok: false, status: response.status, body: await response.text() };
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" && text.length > 0
    ? { ok: true, text }
    : { ok: false, status: 502, body: "empty response" };
}

(async () => {
  const r = await callGoogle('gemini-3.6-flash');
  console.log(r.ok ? 'OK: ' + r.text.slice(0,100) : 'FAIL ' + r.status + ': ' + r.body.slice(0,200));
})();
