"use client";

import Navigation from "./Navigation";

export default function DesktopSidebar() {
  // border-e, not border-r: under rtl the sidebar sits on the right and
  // its dividing edge is the left one. The logical property is correct
  // in both directions.
  return (
    <aside className="hidden md:flex w-64 flex-col border-e border-ink-600 bg-ink-800 p-6">
      <div className="mb-10">
        <h1 className="text-3xl font-bold">
          🐙 Octopus
        </h1>

        <p className="mt-2 text-sm text-mist">
          Smart Business System
        </p>
      </div>

      <Navigation />

      <div className="mt-auto border-t border-ink-600 pt-6">
        <div className="text-sm text-mist">
          الإصدار
        </div>

        <div className="font-semibold">
          v1.0.0
        </div>
      </div>
    </aside>
  );
}