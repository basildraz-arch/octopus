"use client";

import MobileSidebar from "./MobileSidebar";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 md:px-8">

      <div className="flex items-center gap-4">

        <MobileSidebar />

        <div>
          <h1 className="text-lg font-bold">
            🐙 Octopus ERP
          </h1>

          <p className="hidden text-xs text-zinc-400 md:block">
            Smart Business System
          </p>
        </div>

      </div>

      <div className="flex items-center gap-3">

        <button className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 transition">
          👤
        </button>

      </div>

    </header>
  );
}