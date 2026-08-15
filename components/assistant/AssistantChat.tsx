"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Lottie from "lottie-react";

import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { useAssistantChat } from "@/hooks/useAssistantChat";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  link?: { path: string; label: string };
  linkResolved?: "confirmed" | "dismissed";
};

const CLOSE_ANIMATION_MS = 250;

export default function AssistantChat() {
  const router = useRouter();
  const { user } = useSession();
  const { isOpen, close } = useAssistantChat();

  // isOpen (context) is the single source of truth for whether the chat
  // should be open. visible/closing are purely local, derived state for
  // letting the exit animation play before actually unmounting - closing
  // must go back to false once the unmount happens, otherwise the panel
  // can never render again after the very first close.
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
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

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      return;
    }

    if (!visible) return;

    setClosing(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, CLOSE_ANIMATION_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleClose() {
    close();
  }

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

  // Same protection as before: rendered globally now (the mascot that
  // opens it lives on every page), but must never mount its interactive
  // UI for anyone but the business owner - the real enforcement is
  // server-side in app/api/assistant/route.ts, this is defense in depth
  // matching the existing pattern of not even showing the trigger.
  if (!user || user.role !== "owner") return null;

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-4 bottom-20 z-50 flex max-h-[70vh] flex-col overflow-hidden border border-ink-600 bg-ink-800 shadow-2xl md:inset-x-auto md:bottom-6 md:left-4 md:w-96"
      style={{
        transformOrigin: "bottom left",
        animation: closing
          ? "assistant-out 0.25s ease-in forwards"
          : "assistant-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}
    >
      <div className="flex items-center justify-between border-b border-ink-600 p-4">
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
          onClick={handleClose}
          className="text-mist hover:text-paper"
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-mist">
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
                className={`max-w-[85%] rounded-xl p-3 text-right text-sm ${
                  message.role === "user"
                    ? "bg-splash text-ink-950"
                    : "bg-ink-700 text-paper"
                }`}
              >
                {message.text}
              </div>
            </div>

            {message.link && !message.linkResolved && (
              <div className="mt-2 max-w-[85%] space-y-2 rounded-xl border border-splash/40 bg-splash-dim p-3">
                <p className="text-right text-sm text-splash">
                  تحب أوديك لصفحة{" "}
                  {message.link.label.replace("روح لصفحة ", "")} دلوقتي؟
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleLinkDecision(i, "dismissed")}
                    className="rounded-lg bg-ink-700 px-3 py-1.5 text-sm font-semibold text-paper transition hover:bg-ink-600"
                  >
                    ❌ لأ، خليني هنا
                  </button>
                  <button
                    onClick={() => handleLinkDecision(i, "confirmed")}
                    className="rounded-lg bg-splash px-3 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-splash-deep"
                  >
                    ✅ آه وديني
                  </button>
                </div>
              </div>
            )}

            {message.link && message.linkResolved === "dismissed" && (
              <p className="mt-1 text-sm text-mist">
                تمام، خليه هنا 👍
              </p>
            )}
          </div>
        ))}

        {loading && <p className="text-sm text-mist">جارِ التفكير...</p>}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-ink-600 p-3"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="اكتب سؤالك..."
          className="flex-1 rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-paper outline-none focus:border-splash"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-splash px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
        >
          ابعت
        </button>
      </form>
    </div>
  );
}
