"use client";

import type { PriceTier } from "@/lib/priceTier";

type Props = {
  labels: readonly string[];
  selected: PriceTier;
  onChange: (tier: PriceTier) => void;
};

// Which price list this invoice runs on - the shop's own three words
// for its own customers (تيك أواي / صالة / جملة, whatever they call
// them).
//
// This used to sit inside the basket. On a phone the basket is a sheet
// that opens on demand, which put the choice behind a tap and after the
// items had already been added at the wrong price. It belongs with the
// warehouse selector instead: both are settings for the whole invoice,
// both are decided before the first item, and both stay in sight.
//
// Deliberately three plain chips and nothing else - one line, one tap,
// no dropdown to open and no label to read first.
export default function PriceTierPicker({
  labels,
  selected,
  onChange,
}: Props) {
  return (
    <div
      role="group"
      aria-label="قائمة الأسعار"
      className="flex gap-1.5 rounded-2xl bg-ink-800 p-1.5"
    >
      {labels.map((label, index) => {
        const tier = (index + 1) as PriceTier;
        const active = selected === tier;

        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(tier)}
            aria-pressed={active}
            className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-bold transition ${
              active
                ? "bg-splash text-ink-950"
                : "text-mist active:bg-ink-700 md:hover:bg-ink-700"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
