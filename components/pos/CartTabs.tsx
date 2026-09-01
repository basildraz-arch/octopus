"use client";

import { useState } from "react";
import { Plus, X, Pencil } from "lucide-react";

import type { Ticket } from "@/lib/parkedCarts";

type Props = {
  tickets: Ticket[];
  activeId: string | null;
  canOpenMore: boolean;
  onSwitch: (id: string) => void;
  onOpen: () => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
};

// تبويبات الفواتير المفتوحة.
//
// **بتختفي خالص لما تكون فاتورة واحدة أو أقل.** المحل اللي بيبيع
// لزبون واحد في المرة مش المفروض يشوف أي حاجة اتغيّرت - الفيتشرة
// بتظهر أول ما يحتاجها، لما يدوس "+".
//
// وde تطبيق لقاعدة باسل: "الغبي يقدر يستعمله". الشاشة اللي فيها
// تبويب واحد اسمه "فاتورة ١" بتسأل سؤال في دماغ الكاشير من غير ما
// تديله فايدة.
export default function CartTabs({
  tickets,
  activeId,
  canOpenMore,
  onSwitch,
  onOpen,
  onClose,
  onRename,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  // فاتورة واحدة فاضية = محل عادي. مانوريش حاجة.
  if (tickets.length <= 1 && !tickets.some((t) => t.cart.length > 0)) {
    return null;
  }

  function commitRename(id: string) {
    onRename(id, draft);
    setEditingId(null);
    setDraft("");
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {tickets.map((ticket) => {
        const isActive = ticket.id === activeId;
        const lines = ticket.cart.length;

        const total = ticket.cart.reduce((sum, line) => sum + line.total, 0);

        if (editingId === ticket.id) {
          return (
            <input
              key={ticket.id}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commitRename(ticket.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(ticket.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              placeholder="تربيزة ٣"
              maxLength={20}
              className="w-32 rounded-lg border border-splash bg-ink-900 px-3 py-2 text-sm text-paper outline-none"
            />
          );
        }

        return (
          <div
            key={ticket.id}
            className={`flex items-center gap-1 rounded-lg border px-1 transition ${
              isActive
                ? "border-splash bg-splash-dim"
                : "border-ink-600 bg-ink-800"
            }`}
          >
            <button
              type="button"
              onClick={() => onSwitch(ticket.id)}
              onDoubleClick={() => {
                setEditingId(ticket.id);
                setDraft(ticket.name);
              }}
              className="px-2 py-2 text-sm font-semibold text-paper"
            >
              {ticket.name}

              {lines > 0 && (
                <span className="mr-2 text-xs font-normal text-mist">
                  {total.toFixed(0)} ج
                </span>
              )}
            </button>

            {isActive && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(ticket.id);
                  setDraft(ticket.name);
                }}
                aria-label={`غيّر اسم ${ticket.name}`}
                className="rounded p-1 text-mist transition hover:text-paper"
              >
                <Pencil size={13} />
              </button>
            )}

            <button
              type="button"
              onClick={() => onClose(ticket.id)}
              aria-label={`اقفل ${ticket.name}`}
              className="rounded p-1 text-mist transition hover:text-red-400"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      {canOpenMore && (
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1 rounded-lg border border-dashed border-ink-600 px-3 py-2 text-sm font-semibold text-mist transition hover:border-splash hover:text-paper"
        >
          <Plus size={15} />
          فاتورة تانية
        </button>
      )}
    </div>
  );
}
