"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShoppingCart,
} from "lucide-react";

import { useSession } from "@/hooks/useSession";
import {
  getCartAuditByDate,
  summarizeCartSessions,
  abandonedCarts,
  liveCarts,
  CART_STALE_MINUTES,
  type CartAuditEvent,
  type CartSessionSummary,
} from "@/repositories/cartAudit.repository";

function todayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Seconds matter here: this timestamp is what the owner scrubs to in
// the shop's camera recording.
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function SalesAuditPage() {
  const { user } = useSession();

  const [date, setDate] = useState(todayString());
  const [events, setEvents] = useState<CartAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [openSession, setOpenSession] = useState<string | null>(null);

  useEffect(() => {
    if (user) load();
  }, [user, date]);

  async function load() {
    if (!user) return;

    setLoading(true);

    const data = await getCartAuditByDate(user.business_id, date);

    setEvents(data);
    setLoading(false);
  }

  const sessions = summarizeCartSessions(events);

  // ============================================================
  // ساكتة ≠ مفتوحة
  // ============================================================
  //
  // عربية اتحطّ فيها بضاعة وماتنفذتش ممكن تكون حاجة من اتنين:
  // كاشير واقف بيخدم زبون دلوقتي، أو بضاعة خرجت من غير فاتورة.
  // الفرق بينهم **الوقت من آخر حركة** - والتفصيل في
  // `cartAudit.repository.ts`.
  //
  // اللحظة الواحدة بتتحسب مرة واحدة وبتتبعت للاتنين، عشان
  // مايحصلش إن عربية تعدّي الحد بين النداءين فتختفي من القايمتين.
  const now = Date.now();

  const abandoned = abandonedCarts(sessions, now);
  const live = liveCarts(sessions, now);

  const abandonedIds = new Set(abandoned.map((s) => s.cartSessionId));

  const visible: CartSessionSummary[] = showAll ? sessions : abandoned;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <ShieldAlert size={28} />
          سجل الفواتير
        </h1>

        <p className="mt-1 text-mist">
          كل فاتورة اتفتحت - سواء اتنفذت أو اتسابت قبل ما تتنفذ
        </p>
      </div>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl border border-ink-600 bg-ink-800 p-4 text-paper outline-none"
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-red-800 bg-red-950/20 p-4 text-center">
          <div className="text-3xl font-bold text-red-400">
            {abandoned.length}
          </div>

          <div className="mt-1 text-xs text-mist">
            اتفتحت وسابوها
          </div>
        </div>

        {/* العربيات المفتوحة دلوقتي: معلومة، مش إنذار. لونها
            رمادي عن قصد - لو بقت حمرا زي اللي جنبها، صاحب المحل
            هيبص للرقمين على إنهم مشكلة واحدة. */}
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 text-center">
          <div className="text-3xl font-bold text-amber-300">
            {live.length}
          </div>

          <div className="mt-1 text-xs text-mist">
            مفتوحة دلوقتي
          </div>
        </div>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 text-center">
          <div className="text-3xl font-bold text-green-400">
            {sessions.filter((s) => s.completed).length}
          </div>

          <div className="mt-1 text-xs text-mist">
            اتنفذت عادي
          </div>
        </div>
      </div>

      {/* السطر ده بيمنع سؤال "طب ليه دي مش محسوبة؟" قبل ما يتسأل. */}
      {live.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-ink-600 bg-ink-800/60 p-3 text-xs text-mist">
          <ShoppingCart size={14} className="mt-0.5 shrink-0" />
          <span>
            فيه {live.length} عربية فيها بضاعة ولسه شغالة (آخر حركة فيها
            من أقل من {CART_STALE_MINUTES} دقيقة). دي شغل جاري - بتتحسب
            «اتفتحت وسابوها» لو سكتت {CART_STALE_MINUTES} دقيقة من غير
            أي حركة.
          </span>
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setShowAll(false)}
          className={`flex-1 rounded-xl p-3 text-sm font-bold transition ${
            !showAll
              ? "bg-splash text-ink-950"
              : "border border-ink-600 bg-ink-800 text-mist"
          }`}
        >
          اتفتحت وسابوها
        </button>

        <button
          onClick={() => setShowAll(true)}
          className={`flex-1 rounded-xl p-3 text-sm font-bold transition ${
            showAll
              ? "bg-splash text-ink-950"
              : "border border-ink-600 bg-ink-800 text-mist"
          }`}
        >
          كل الفواتير
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-mist">
          جارِ التحميل...
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
          {showAll
            ? "مفيش أي نشاط في اليوم ده"
            : "مفيش أي فاتورة اتفتحت واتسابت في اليوم ده 👌"}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((session) => {
            const isOpen = openSession === session.cartSessionId;

            const sessionEvents = events.filter(
              (event) => event.cart_session_id === session.cartSessionId
            );

            return (
              <div
                key={session.cartSessionId}
                className={`rounded-xl border p-4 ${
                  abandonedIds.has(session.cartSessionId)
                    ? "border-red-800 bg-red-950/20"
                    : "border-ink-600 bg-ink-800"
                }`}
              >
                <button
                  onClick={() =>
                    setOpenSession(isOpen ? null : session.cartSessionId)
                  }
                  className="w-full text-right"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-bold text-paper">
                      {session.completed ? (
                        <CheckCircle2 size={16} className="text-green-400" />
                      ) : abandonedIds.has(session.cartSessionId) ? (
                        <AlertTriangle size={16} className="text-red-400" />
                      ) : (
                        <ShoppingCart size={16} className="text-amber-300" />
                      )}
                      {session.userName}
                    </span>

                    <span className="flex items-center gap-1.5 text-sm text-mist">
                      <Clock size={14} />
                      {formatTime(session.openedAt)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mist">
                    <span>أصناف اتضافت: {session.addedCount}</span>
                    <span>اتمسحت: {session.removedCount}</span>
                    <span>قيمة: {session.addedValue.toFixed(2)} جنيه</span>
                    {session.quoteCount > 0 && (
                      <span>عروض سعر مطبوعة: {session.quoteCount}</span>
                    )}
                  </div>

                  {!session.completed &&
                    (abandonedIds.has(session.cartSessionId) ? (
                      <div className="mt-2 text-sm font-bold text-red-400">
                        اتفتحت وسابوها — آخر حركة{" "}
                        {formatTime(session.lastEventAt)}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm font-semibold text-amber-300">
                        لسه مفتوحة — آخر حركة {formatTime(session.lastEventAt)}
                      </div>
                    ))}
                </button>

                {isOpen && (
                  <div className="mt-4 space-y-2 border-t border-ink-600 pt-3">
                    {sessionEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span
                          className={
                            event.action === "remove"
                              ? "text-red-400"
                              : event.action === "checkout"
                              ? "text-green-400"
                              : "text-mist"
                          }
                        >
                          {event.action === "add" && "➕ ضاف"}
                          {event.action === "remove" && "🗑️ مسح"}
                          {event.action === "checkout" && "✅ نفّذ الفاتورة"}
                          {event.action === "quote" && "🖨️ طبع عرض سعر"}
                          {event.item_name ? ` ${event.item_name}` : ""}
                          {event.quantity != null
                            ? ` × ${Number(event.quantity).toFixed(2)}`
                            : ""}
                        </span>

                        <span className="text-mist">
                          {formatTime(event.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
