"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Lottie from "lottie-react";

import { supabase } from "@/lib/supabase";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  link?: { path: string; label: string };
  linkResolved?: "confirmed" | "dismissed";
};

export default function AssistantChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    fetch("/hebr-animation.json")
      .then((res) => res.json())
      .then(setAnimationData)
      .catch(() => setAnimationData(null));
  }, []);

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

  function handleLinkDecision(
    index: number,
    decision: "confirmed" | "dismissed"
  ) {
    setMessages((prev) =>
      prev.map((message, i) =>
        i === index ? { ...message, linkResolved: decision } : message
      )
    );

    if (decision === "confirmed") {
      const path = messages[index].link?.path;
      if (path) router.push(path);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[#12151F] shadow-lg transition hover:scale-105 md:bottom-6"
        aria-label="اسأل الأخطبوط"
      >
        {animationData ? (
          <Lottie
            animationData={animationData}
            loop
            autoplay
            style={{ width: 44, height: 44 }}
          />
        ) : (
          <img
            src="/hebr-final-1.jpg"
            alt="حبر"
            className="h-full w-full rounded-full object-cover"
          />
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 flex max-h-[70vh] flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl md:inset-x-auto md:bottom-6 md:left-4 md:w-96">
      <div className="flex items-center justify-between border-b border-zinc-800 p-4">
        <h2 className="flex items-center gap-2 font-bold">
          {animationData ? (
            <Lottie
              animationData={animationData}
              loop
              autoplay
              style={{ width: 40, height: 40 }}
            />
          ) : (
            <img
              src="/hebr-final-1.jpg"
              alt="حبر"
              className="h-10 w-10 rounded-full object-cover"
            />
          )}
          اسأل الأخطبوط
        </h2>
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

            {message.link && !message.linkResolved && (
              <div className="mt-2 max-w-[85%] space-y-2 rounded-xl border border-blue-600 bg-blue-600/10 p-3">
                <p className="text-right text-sm text-blue-300">
                  تحب أوديك لصفحة{" "}
                  {message.link.label.replace("روح لصفحة ", "")} دلوقتي؟
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleLinkDecision(i, "dismissed")}
                    className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-600"
                  >
                    ❌ لأ، خليني هنا
                  </button>
                  <button
                    onClick={() => handleLinkDecision(i, "confirmed")}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    ✅ آه وديني
                  </button>
                </div>
              </div>
            )}

            {message.link && message.linkResolved === "dismissed" && (
              <p className="mt-1 text-sm text-zinc-500">
                تمام، خليه هنا 👍
              </p>
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
