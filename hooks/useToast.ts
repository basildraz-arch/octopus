"use client";

import { useContext } from "react";

import { ToastContext } from "@/components/toast/ToastProvider";

export function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return {
    success: (message: string) => ctx.push("success", message),
    error: (message: string) => ctx.push("error", message),
    warning: (message: string) => ctx.push("warning", message),
  };
}
