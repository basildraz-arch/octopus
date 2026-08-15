"use client";

import { useContext } from "react";

import { AssistantChatContext } from "@/components/assistant/AssistantChatProvider";

export function useAssistantChat() {
  const ctx = useContext(AssistantChatContext);

  if (!ctx) {
    throw new Error("useAssistantChat must be used within AssistantChatProvider");
  }

  return ctx;
}
