"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  getSalesByDateRange,
  type SaleWithItems,
} from "@/repositories/sale.repository";
import { useSession } from "@/hooks/useSession";

function todayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function SalesLogContent() {
  const { user } = useSession();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState(
    searchParams.get("from") ?? todayString()
  );
  const [endDate, setEndDate] = useState(
    searchParams.get("to") ?? todayString()
  );
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    loadSales();
  }, [user, startDate, endDate]);

  async function loadSales() {
    if (!user) return;

    setLoading(true);

    const data = await getSalesByDateRange(
      user.business_id,
      startDate,
      endDate
    );

    setSales(data);

    setLoading(false);
  }

  const periodTotal = useMemo(() => {
    return sales.reduce((sum, sale) => sum + sale.total, 0);
  }, [sales]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          📒 سجل المبيعات
        </h1>

        <p className="mt-1 text-zinc-400">
          تابع مبيعات محلك أول بأول
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm text-zinc-400">
          إجمالي المبيعات في الفترة المحددة
        </p>

        <h2 className="mt-2 text-4xl font-bold text-green-400">
          {periodTotal.toFixed(2)} ج
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          {sales.length} عملية بيع
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">
            من
          </label>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-400">
            إلى
          </label>

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-white outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-zinc-400">
          جارِ التحميل...
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          لا توجد مبيعات في هذه الفترة
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => (
            <details
              key={sale.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <summary className="flex cursor-pointer items-center justify-between">
                <span className="text-sm text-zinc-400">
                  {new Date(sale.created_at).toLocaleString("ar-EG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>

                <span className="font-bold text-green-400">
                  {sale.total.toFixed(2)} ج
                </span>
              </summary>

              <div className="mt-3 space-y-1 border-t border-zinc-800 pt-3">
                {sale.sale_items.map((line) => (
                  <div
                    key={line.id}
                    className="flex justify-between text-sm text-zinc-300"
                  >
                    <span>
                      {line.items?.name ?? "صنف محذوف"} × {line.quantity.toFixed(2)}
                    </span>

                    <span>
                      {line.total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}

export default function SalesLogPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-center text-zinc-400">
          جارِ التحميل...
        </main>
      }
    >
      <SalesLogContent />
    </Suspense>
  );
}
