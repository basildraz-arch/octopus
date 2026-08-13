"use client";

import { useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabase";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  link?: { path: string; label: string };
};

export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setError("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("لازم تسجّل الدخول الأول");
      }

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ question: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "حدث خطأ");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer, link: data.link },
      ]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء التواصل مع المساعد";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl shadow-lg transition hover:bg-blue-700 md:bottom-6"
        aria-label="اسأل الأخطبوط"
      >
        🐙
      </button>
    );
  }

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 flex max-h-[70vh] flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl md:inset-x-auto md:bottom-6 md:left-4 md:w-96">
      <div className="flex items-center justify-between border-b border-zinc-800 p-4">
        <h2 className="font-bold">🐙 اسأل الأخطبوط</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-zinc-400 hover:text-white"
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            اسألني أي حاجة عن بيزنسك، زي &quot;قد إيه مبيعاتي النهاردة؟&quot;
          </p>
        )}

        {messages.map((message, i) => (
          <div key={i}>
            <div
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-3 text-right text-sm text-white ${
                  message.role === "user" ? "bg-blue-600" : "bg-zinc-800"
                }`}
              >
                {message.text}
              </div>
            </div>

            {message.link && (
              <div className="mt-2 flex justify-start">
                <Link
                  href={message.link.path}
                  className="rounded-xl border border-blue-600 bg-blue-600/10 px-3 py-2 text-sm font-semibold text-blue-400 transition hover:bg-blue-600/20"
                >
                  {message.link.label}
                </Link>
              </div>
            )}
          </div>
        ))}

        {loading && <p className="text-sm text-zinc-500">جارِ التفكير...</p>}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-zinc-800 p-3"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="اكتب سؤالك..."
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          ابعت
        </button>
      </form>
    </div>
  );
}
