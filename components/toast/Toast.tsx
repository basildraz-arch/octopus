"use client";

import { CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning";

const VARIANT: Record<
  ToastType,
  { icon: typeof CheckCircle2; accent: string; iconColor: string }
> = {
  success: { icon: CheckCircle2, accent: "bg-green-500", iconColor: "text-green-400" },
  error: { icon: XCircle, accent: "bg-red-500", iconColor: "text-red-400" },
  warning: { icon: AlertTriangle, accent: "bg-amber-500", iconColor: "text-amber-400" },
};

type Props = {
  type: ToastType;
  message: string;
  leaving: boolean;
  onDismiss: () => void;
};

export default function Toast({ type, message, leaving, onDismiss }: Props) {
  const { icon: Icon, accent, iconColor } = VARIANT[type];

  return (
    <div
      className="relative flex min-w-[260px] max-w-sm items-start gap-3 overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 py-3 pe-3 ps-4 shadow-2xl"
      style={{
        animation: leaving
          ? "toast-out 0.25s ease-in forwards"
          : "toast-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}
    >
      {/* start-0: the colour stripe belongs on the reading edge, which
          is the right in Arabic. */}
      <span className={`absolute inset-y-0 start-0 w-1.5 ${accent}`} />

      <Icon size={20} className={`mt-0.5 shrink-0 ${iconColor}`} />

      <p className="flex-1 text-right text-sm text-paper">{message}</p>

      <button
        onClick={onDismiss}
        className="shrink-0 text-mist transition hover:text-paper"
        aria-label="إغلاق"
      >
        <X size={16} />
      </button>
    </div>
  );
}
