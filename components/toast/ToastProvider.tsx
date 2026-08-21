"use client";

import { createContext, useCallback, useRef, useState, type ReactNode } from "react";

import Toast, { type ToastType } from "./Toast";

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
  leaving: boolean;
};

export const ToastContext = createContext<{
  push: (type: ToastType, message: string) => void;
} | null>(null);

const DISPLAY_MS = 4000;
const EXIT_MS = 250;

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_MS);
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current;

      setToasts((prev) => [...prev, { id, type, message, leaving: false }]);
      setTimeout(() => dismiss(id), DISPLAY_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 print:hidden">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast
              type={t.type}
              message={t.message}
              leaving={t.leaving}
              onDismiss={() => dismiss(t.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
