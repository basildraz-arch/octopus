"use client";

import { useEffect, useState } from "react";
import { Ban, Undo2 } from "lucide-react";

import {
  getVoidedSales,
  getSaleReturns,
  type VoidedSale,
  type SaleReturn,
} from "@/repositories/sale.repository";

type Props = {
  businessId: string;
  from: string;
  to: string;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ============================================================
// الفجوة في دفتر الفواتير لازم يكون ليها سطر بيفسّرها
// ============================================================
//
// الإلغاء بيمسح الفاتورة من الجدول - وde صح، هي اتسجّلت غلط أصلًا.
// بس بعد ما بقى فيه ترقيم مسلسل (ميجريشن ٠٩٣)، إلغاء فاتورة رقم
// ٤٧ بيسيب فجوة بين ٤٦ و٤٨.
//
// السجل كان موجود في القاعدة من ميجريشن ٠٨٥ ومحدش بيقراه. الشاشة
// دي بتخليه ظاهر: **رقم الفاتورة، ومين لغاها، وإمتى، وليه**.
//
// ومطويّة افتراضيًا: دي حاجة بتتشاف لما حد يسأل، مش كل يوم.
// (وبتتفتح لوحدها وقت الطباعة - `app/globals.css`.)
export default function VoidedAndReturns({ businessId, from, to }: Props) {
  const [voids, setVoids] = useState<VoidedSale[]>([]);
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    Promise.all([
      getVoidedSales(businessId, from, to),
      getSaleReturns(businessId, from, to),
    ]).then(([v, r]) => {
      if (cancelled) return;

      setVoids(v);
      setReturns(r);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [businessId, from, to]);

  const total = voids.length + returns.length;

  // مفيش إلغاء ولا مرتجع = مفيش حاجة تتقال. كارت بيقول "صفر"
  // مساحة ضايعة على شاشة بتتفتح كل يوم.
  if (loading || total === 0) return null;

  const voidedValue = voids.reduce((sum, v) => sum + Number(v.sale_total), 0);
  const refunded = returns.reduce((sum, r) => sum + Number(r.refund_amount), 0);

  return (
    <details className="rounded-xl border border-ink-600 bg-ink-800">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <span className="flex items-center gap-2 font-semibold text-paper">
          <Ban size={16} className="text-red-400" />
          الملغي والمرتجع
        </span>

        <span className="text-xs text-mist">
          {voids.length > 0 && `${voids.length} ملغية`}
          {voids.length > 0 && returns.length > 0 && " · "}
          {returns.length > 0 && `${returns.length} مرتجع`}
        </span>
      </summary>

      <div className="space-y-4 border-t border-ink-600 p-4">
        {voids.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-mist">
              فواتير اتلغت — قيمتها كانت {voidedValue.toFixed(2)} ج
            </p>

            <div className="space-y-2">
              {voids.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-red-900/60 bg-red-950/20 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-paper">
                      {/* الرقم هو اللي بيفسّر الفجوة. الفواتير
                          اللي اتلغت قبل ميجريشن ٠٩٣ مالهاش رقم
                          متسجّل - بنقول كده صراحةً بدل ما نخترع. */}
                      {row.invoice_number != null
                        ? `فاتورة ${row.invoice_number}`
                        : "فاتورة (من غير رقم)"}
                    </span>

                    <span className="font-bold text-red-400">
                      {Number(row.sale_total).toFixed(2)} ج
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-mist">
                    اتلغت {formatWhen(row.voided_at)}
                    {row.users?.full_name && ` — ${row.users.full_name}`}
                  </p>

                  {row.reason && (
                    <p className="mt-1 text-xs text-amber-300">
                      السبب: {row.reason}
                    </p>
                  )}

                  {Array.isArray(row.lines) && row.lines.length > 0 && (
                    <p className="mt-1 text-xs text-mist">
                      {row.lines
                        .map((line) => `${line.name} × ${line.quantity}`)
                        .join("، ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {returns.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-mist">
              <Undo2 size={12} />
              مرتجعات — اترجّع {refunded.toFixed(2)} ج
            </p>

            <div className="space-y-2">
              {returns.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-ink-600 bg-ink-900 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-mist">
                      {formatWhen(row.returned_at)}
                      {row.users?.full_name && ` — ${row.users.full_name}`}
                    </span>

                    <span className="font-bold text-amber-300">
                      {Number(row.refund_amount).toFixed(2)} ج
                    </span>
                  </div>

                  {Array.isArray(row.lines) && row.lines.length > 0 && (
                    <p className="mt-1 text-xs text-mist">
                      {row.lines
                        .map((line) => `${line.name} × ${line.quantity}`)
                        .join("، ")}
                    </p>
                  )}

                  {row.reason && (
                    <p className="mt-1 text-xs text-amber-300">
                      السبب: {row.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
