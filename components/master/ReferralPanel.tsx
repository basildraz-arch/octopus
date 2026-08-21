"use client";

import { useEffect, useState } from "react";
import { Share2, Plus, Power, Wallet } from "lucide-react";

import { getReferralSummaries } from "@/repositories/referral.repository";
import { runReferralAction } from "@/services/master.service";
import { useToast } from "@/hooks/useToast";
import { REFERRAL_KIND_LABELS, type ReferralSummary } from "@/types/referral";
import type { MasterBusinessRow } from "@/app/api/master/overview/route";

function money(value: number): string {
  return `${value.toFixed(0)} ج`;
}

function monthLabel(): string {
  return new Date().toLocaleDateString("ar-EG", {
    month: "long",
    year: "numeric",
  });
}

export default function ReferralPanel({
  businesses,
}: {
  businesses: MasterBusinessRow[];
}) {
  const toast = useToast();

  const [summaries, setSummaries] = useState<ReferralSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"customer" | "marketer">("customer");
  const [holderName, setHolderName] = useState("");
  const [holderPhone, setHolderPhone] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [monthlyReward, setMonthlyReward] = useState("200");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      setSummaries(await getReferralSummaries());
    } finally {
      setLoading(false);
    }
  }

  async function createCode(e: React.FormEvent) {
    e.preventDefault();

    setBusy("new");

    try {
      await runReferralAction({
        action: "create_code",
        code,
        kind,
        holderName,
        holderPhone: holderPhone || undefined,
        businessId: kind === "customer" ? businessId : undefined,
        monthlyReward: Number(monthlyReward),
      });

      toast.success("الكود اتعمل");

      setCode("");
      setHolderName("");
      setHolderPhone("");
      setBusinessId("");
      setCreating(false);

      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إنشاء الكود");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(summary: ReferralSummary) {
    setBusy(summary.code.id);

    try {
      await runReferralAction({
        action: "set_code_active",
        codeId: summary.code.id,
        active: !summary.code.active,
      });

      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر التعديل");
    } finally {
      setBusy(null);
    }
  }

  async function payout(summary: ReferralSummary) {
    if (summary.monthlyAmount <= 0) return;

    setBusy(summary.code.id);

    try {
      await runReferralAction({
        action: "record_payout",
        codeId: summary.code.id,
        amount: summary.monthlyAmount,
        periodLabel: monthLabel(),
      });

      toast.success("اتسجلت الدفعة");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر التسجيل");
    } finally {
      setBusy(null);
    }
  }

  const owedThisMonth = summaries.reduce(
    (sum, summary) => sum + summary.monthlyAmount,
    0
  );

  const cashOwed = summaries
    .filter((summary) => summary.code.kind === "marketer")
    .reduce((sum, summary) => sum + summary.monthlyAmount, 0);

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          <Share2 size={16} />
          الإحالات
        </h2>

        <button
          onClick={() => setCreating((current) => !current)}
          className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-1.5 text-sm text-mist hover:text-paper"
        >
          <Plus size={14} />
          كود جديد
        </button>
      </div>

      {/* The two numbers that matter: what the month costs, and how
          much of it has to leave as cash rather than come off a bill. */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-ink-600 bg-ink-950 p-3">
          <p className="text-xs text-mist">مستحق الشهر ده</p>
          <p className="mt-1 text-2xl font-bold text-paper">
            {money(owedThisMonth)}
          </p>
        </div>

        <div className="rounded-lg border border-ink-600 bg-ink-950 p-3">
          <p className="text-xs text-mist">منها كاش للمسوّقين</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">
            {money(cashOwed)}
          </p>
        </div>
      </div>

      {creating && (
        <form
          onSubmit={createCode}
          className="mb-4 space-y-2 rounded-lg border border-ink-600 bg-ink-950 p-3"
        >
          <div className="flex gap-2">
            {(["customer", "marketer"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  kind === option
                    ? "bg-splash text-ink-950"
                    : "border border-ink-600 text-mist"
                }`}
              >
                {REFERRAL_KIND_LABELS[option]}
              </button>
            ))}
          </div>

          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="الكود (KERO26)"
            dir="ltr"
            className="w-full rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-paper outline-none"
          />

          <input
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="اسم صاحب الكود"
            className="w-full rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-paper outline-none"
          />

          <input
            value={holderPhone}
            onChange={(e) => setHolderPhone(e.target.value)}
            placeholder="التليفون (اختياري)"
            dir="ltr"
            className="w-full rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-paper outline-none"
          />

          {kind === "customer" && (
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              className="w-full rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-paper outline-none"
            >
              <option value="">المحل صاحب الكود</option>

              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          )}

          <label className="block text-xs text-mist">
            المكافأة الشهرية عن كل محل (لمدة 12 شهر)
            <input
              value={monthlyReward}
              onChange={(e) => setMonthlyReward(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-paper outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={busy === "new"}
            className="w-full rounded-lg bg-splash p-2 text-sm font-bold text-ink-950 disabled:opacity-50"
          >
            اعمل الكود
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-mist">جارِ التحميل...</p>
      ) : summaries.length === 0 ? (
        <p className="text-xs text-mist">مفيش أكواد إحالة لسه</p>
      ) : (
        <div className="space-y-2">
          {summaries.map((summary) => (
            <div
              key={summary.code.id}
              className={`rounded-lg border p-3 ${
                summary.code.active
                  ? "border-ink-600 bg-ink-950"
                  : "border-ink-700 bg-ink-950/50 opacity-70"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 font-bold text-paper">
                    <span dir="ltr" className="font-mono text-splash">
                      {summary.code.code}
                    </span>

                    <span className="text-xs font-normal text-mist">
                      {REFERRAL_KIND_LABELS[summary.code.kind]} ·{" "}
                      {summary.code.holder_name}
                    </span>
                  </p>

                  <p className="mt-1 text-xs text-mist">
                    {summary.signedUpCount} سجّلوا · {summary.earningCount}{" "}
                    بيدفعوا دلوقتي · اتصرفله {money(summary.totalPaid)}
                  </p>
                </div>

                <p className="text-lg font-bold text-green-400">
                  {money(summary.monthlyAmount)}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    setOpenId(openId === summary.code.id ? null : summary.code.id)
                  }
                  className="rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-mist hover:text-paper"
                >
                  المحلات ({summary.signedUpCount})
                </button>

                {summary.code.kind === "marketer" && summary.monthlyAmount > 0 && (
                  <button
                    onClick={() => payout(summary)}
                    disabled={busy === summary.code.id}
                    className="flex items-center gap-1 rounded-lg bg-ink-700 px-2.5 py-1 text-xs font-semibold text-paper hover:bg-ink-600 disabled:opacity-50"
                  >
                    <Wallet size={12} />
                    سجّل صرف {money(summary.monthlyAmount)}
                  </button>
                )}

                <button
                  onClick={() => toggle(summary)}
                  disabled={busy === summary.code.id}
                  className="flex items-center gap-1 rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-mist hover:text-paper disabled:opacity-50"
                >
                  <Power size={12} />
                  {summary.code.active ? "أوقف" : "فعّل"}
                </button>
              </div>

              {openId === summary.code.id && (
                <div className="mt-2 space-y-1 border-t border-ink-700 pt-2">
                  {summary.shops.length === 0 ? (
                    <p className="text-xs text-mist">محدش سجّل بالكود ده لسه</p>
                  ) : (
                    summary.shops.map((shop) => (
                      <div
                        key={shop.id}
                        className="flex flex-wrap justify-between gap-2 text-xs"
                      >
                        <span className="text-paper">{shop.businessName}</span>

                        <span
                          className={
                            shop.earning
                              ? "text-green-400"
                              : shop.qualified_at
                              ? "text-mist"
                              : "text-amber-400"
                          }
                        >
                          {shop.earning
                            ? "بيدفع - المكافأة شغالة"
                            : shop.qualified_at
                            ? "وقف الدفع أو خلصت الـ12 شهر"
                            : "سجّل ولسه ما دفعش"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
