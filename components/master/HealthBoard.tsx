"use client";

import { HeartPulse, ChevronLeft, CheckCircle2 } from "lucide-react";

import type { MasterBusinessRow } from "@/app/api/master/overview/route";
import { worstLevel, type HealthLevel } from "@/lib/shopHealth";

type Props = {
  rows: MasterBusinessRow[];

  // بيفتح المحل في القايمة اللي تحت بدل ما يعمل شاشة تانية.
  onOpen: (businessId: string) => void;
};

const LEVEL_STYLE: Record<HealthLevel, string> = {
  danger: "border-red-800 bg-red-950/25",
  warn: "border-amber-900/70 bg-amber-950/15",
  info: "border-ink-600 bg-ink-800",
};

const DOT: Record<HealthLevel, string> = {
  danger: "bg-red-500",
  warn: "bg-amber-400",
  info: "bg-mist",
};

// ============================================================
// لوحة الصحة — أول حاجة على شاشة الماستر
// ============================================================
//
// باسل: "عايزه يبقى الأساس يقدر يشوف ويتحكم في كل حاجة بحيث أكون
// عامل حوكمة للبزنس بتاعي كله."
//
// الحوكمة **مش** شاشة فيها كل الأرقام. الشاشة اللي فيها كل الأرقام
// بتتفتح مرتين وبعدين بتتنسى، لأنها بتطلب منك تدوّر بنفسك على اللي
// وحش وسط اللي كويس.
//
// الحوكمة إن الشاشة تقولك **مين محتاجك النهاردة** وتسكت عن الباقي.
// عشان كده المحلات السليمة هنا **مش بتتعرض خالص** - بيتعدّوا في
// سطر واحد وخلاص. اللي بيتعرض هو اللي فيه حاجة.
export default function HealthBoard({ rows, onOpen }: Props) {
  const needsAttention = rows
    .filter((row) => row.health.length > 0)
    .sort((a, b) => b.healthScore - a.healthScore);

  const healthy = rows.length - needsAttention.length;

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-paper">
          <HeartPulse size={20} className="text-splash" />
          مين محتاجك النهاردة
        </h2>

        {healthy > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-mist">
            <CheckCircle2 size={13} className="text-green-400" />
            {healthy} محل تمام
          </span>
        )}
      </div>

      {needsAttention.length === 0 ? (
        <div className="rounded-2xl border border-green-900 bg-green-950/20 p-6 text-center">
          <p className="font-bold text-green-400">كل المحلات تمام 👌</p>
          <p className="mt-1 text-xs text-mist">
            مفيش اشتراك قرّب يخلص، ولا محل وقف، ولا وردية سايبة.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {needsAttention.map((row) => {
            const level = worstLevel(row.health) ?? "info";

            return (
              <button
                key={row.id}
                onClick={() => onOpen(row.id)}
                className={`flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-start transition hover:border-splash ${LEVEL_STYLE[level]}`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-bold text-paper">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${DOT[level]}`}
                    />
                    {row.name}

                    {row.ownerName && (
                      <span className="text-xs font-normal text-mist">
                        · {row.ownerName}
                      </span>
                    )}
                  </span>

                  {/* كل تنبيه سطر لوحده. الجمع في سطر واحد بيخلّي
                      "الاشتراك خلص" و"وصل حد الموظفين" ليهم نفس
                      الوزن البصري، وهما مش زي بعض. */}
                  <span className="mt-2 block space-y-1">
                    {row.health.map((flag) => (
                      <span
                        key={flag.key}
                        className={`block text-sm ${
                          flag.level === "danger"
                            ? "text-red-300"
                            : flag.level === "warn"
                            ? "text-amber-200"
                            : "text-mist"
                        }`}
                      >
                        {flag.text}
                      </span>
                    ))}
                  </span>
                </span>

                <ChevronLeft size={18} className="mt-1 shrink-0 text-mist" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
