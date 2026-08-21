"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

import { useSession } from "@/hooks/useSession";
import {
  getCartAuditByDate,
  summarizeCartSessions,
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

  // A basket that was built and never rung up. Also catches the case
  // where the cashier simply closed the page instead of pressing
  // delete - there's no "cancel" click to rely on.
  const suspicious = sessions.filter(
    (session) => !session.completed && session.addedCount > 0
  );

  const visible: CartSessionSummary[] = showAll ? sessions : suspicious;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <ShieldAlert size={28} />
          سجل الفواتير
        </h1>

        <p className="mt-1 text-mist">
          كل فاتورة اتفتحت - سواء اتنفذت أو اتمسحت قبل ما تتنفذ
        </p>
      </div>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl border border-ink-600 bg-ink-800 p-4 text-paper outline-none"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-red-800 bg-red-950/20 p-4 text-center">
          <div className="text-3xl font-bold text-red-400">
            {suspicious.length}
          </div>

          <div className="mt-1 text-xs text-mist">
            فاتورة اتفتحت وماتنفذتش
          </div>
        </div>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 text-center">
          <div className="text-3xl font-bold text-green-400">
            {sessions.length - suspicious.length}
          </div>

          <div className="mt-1 text-xs text-mist">
            فاتورة اتنفذت عادي
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowAll(false)}
          className={`flex-1 rounded-xl p-3 text-sm font-bold transition ${
            !showAll
              ? "bg-splash text-ink-950"
              : "border border-ink-600 bg-ink-800 text-mist"
          }`}
        >
          المشبوهة بس
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
            : "مفيش أي فاتورة مشبوهة في اليوم ده 👌"}
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
                  session.completed
                    ? "border-ink-600 bg-ink-800"
                    : "border-red-800 bg-red-950/20"
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
                      ) : (
                        <AlertTriangle size={16} className="text-red-400" />
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

                  {!session.completed && (
                    <div className="mt-2 text-sm font-bold text-red-400">
                      الفاتورة دي اتفتحت وماتنفذتش — آخر حركة{" "}
                      {formatTime(session.lastEventAt)}
                    </div>
                  )}
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
