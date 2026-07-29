"use client";

import Navigation from "./Navigation";

export default function DesktopSidebar() {
  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-10">
        <h1 className="text-3xl font-bold">
          🐙 Octopus
        </h1>

        <p className="mt-2 text-sm text-zinc-400">
          Smart Business System
        </p>
      </div>

      <Navigation />

      <div className="mt-auto border-t border-zinc-800 pt-6">
        <div className="text-sm text-zinc-400">
          الإصدار
        </div>

        <div className="font-semibold">
          v1.0.0
        </div>
      </div>
    </aside>
  );
}