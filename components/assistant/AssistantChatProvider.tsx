"use client";

import { createContext, useState, type ReactNode } from "react";

type Origin = { x: number; y: number };

export const AssistantChatContext = createContext<{
  isOpen: boolean;
  origin: Origin | null;
  open: (origin?: Origin) => void;
  close: () => void;
} | null>(null);

export default function AssistantChatProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [origin, setOrigin] = useState<Origin | null>(null);

  return (
    <AssistantChatContext.Provider
      value={{
        isOpen,
        origin,
        // origin is where the ink-flood entrance should erupt from (the
        // octopus's on-screen position at the moment it was clicked) - the
        // mascot passes it in, everyone else can omit it and the panel
        // falls back to a fixed anchor point.
        open: (o) => {
          if (o) setOrigin(o);
          setIsOpen(true);
        },
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </AssistantChatContext.Provider>
  );
}
