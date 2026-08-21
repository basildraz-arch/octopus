"use client";

import { useState } from "react";

import {
  contextForRole,
  visibleNavItems,
  visibleTiles,
  ROUTE_RULES,
  canOpen,
} from "@/lib/navItems";
import { DEFAULT_LABELS, LABEL_KEYS, type UiLabels } from "@/lib/uiLabels";
import { STAFF_ROLE_LABELS, type StaffRole } from "@/lib/permissions";
import type { FeatureKey } from "@/types/business";

type Role = "owner" | StaffRole;

const ROLES: Role[] = ["owner", "manager", "cashier", "stock_keeper"];

const ROLE_TITLES: Record<Role, string> = {
  owner: "صاحب النشاط",
  ...STAFF_ROLE_LABELS,
};

// What the shop actually sees, worked out the same way the shop
// works it out.
//
// This deliberately does NOT re-implement the rules. It builds a
// context for somebody else's business and runs visibleNavItems,
// visibleTiles and canOpen - the exact functions the real sidebar,
// the real home screen and the real route guard run. A preview that
// kept its own copy of the rules would be right today and wrong the
// first time one of them changed.
export default function ScreenPreview({
  features,
  labels,
}: {
  features: FeatureKey[];
  labels: Record<string, string>;
}) {
  const [role, setRole] = useState<Role>("owner");

  const resolved: UiLabels = { ...DEFAULT_LABELS };

  for (const key of LABEL_KEYS) {
    const value = labels[key];

    if (typeof value === "string" && value.trim()) resolved[key] = value.trim();
  }

  const ctx = contextForRole(features, role);

  const nav = visibleNavItems(ctx, resolved);
  const daily = visibleTiles(ctx, resolved, "daily");
  const management = visibleTiles(ctx, resolved, "management");

  const openable = ROUTE_RULES.filter((rule) => canOpen(rule.prefix, ctx));
  const blocked = ROUTE_RULES.filter((rule) => !canOpen(rule.prefix, ctx));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ROLES.map((option) => (
          <button
            key={option}
            onClick={() => setRole(option)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              role === option
                ? "bg-splash text-ink-950"
                : "border border-ink-600 text-mist hover:text-paper"
            }`}
          >
            {ROLE_TITLES[option]}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-950 p-3">
        <p className="mb-2 text-[11px] text-mist">القائمة الجانبية</p>

        {nav.length === 0 ? (
          <p className="text-xs text-red-400">
            مفيش أي صفحة - الشخص ده هيفتح البرنامج ويلاقيه فاضي
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {nav.map((item) => (
              <span
                key={item.id}
                className="rounded-lg bg-ink-700 px-2.5 py-1 text-xs text-paper"
              >
                {item.icon} {item.text}
              </span>
            ))}
          </div>
        )}
      </div>

      {role === "owner" && (
        <div className="rounded-xl border border-ink-600 bg-ink-950 p-3">
          <p className="mb-2 text-[11px] text-mist">
            مربعات الشاشة الرئيسية
          </p>

          <div className="flex flex-wrap gap-1.5">
            {[...daily, ...management].map((tile) => (
              <span
                key={`${tile.group}-${tile.id}`}
                className={`rounded-lg px-2.5 py-1 text-xs ${
                  tile.group === "daily"
                    ? "bg-ink-700 text-paper"
                    : "border border-ink-600 text-mist"
                }`}
              >
                {tile.icon} {tile.text}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-green-900 bg-green-950/20 p-3">
          <p className="mb-1.5 text-[11px] text-green-400">
            يقدر يفتح ({openable.length})
          </p>

          <p className="text-[11px] leading-5 text-mist" dir="ltr">
            {openable.map((rule) => rule.prefix).join("  ·  ") || "—"}
          </p>
        </div>

        <div className="rounded-xl border border-ink-600 bg-ink-950 p-3">
          <p className="mb-1.5 text-[11px] text-mist">
            هيترد من عليها ({blocked.length})
          </p>

          <p className="text-[11px] leading-5 text-mist/60" dir="ltr">
            {blocked.map((rule) => rule.prefix).join("  ·  ") || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
