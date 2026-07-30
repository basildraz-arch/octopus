"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getSalesByDate,
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

export default function SalesLogPage() {
  const { user } = useSession();

  const [date, setDate] = useState(todayString());
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    loadSales();
  }, [user, date]);

  async function loadSales() {
    if (!user) return;

    setLoading(true);

    const data = await getSalesByDate(user.business_id, date);

    setSales(data);

    setLoading(false);
  }

  const dayTotal = useMemo(() => {
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
          إجمالي مبيعات اليوم المحدد
        </p>

        <h2 className="mt-2 text-4xl font-bold text-green-400">
          {dayTotal.toFixed(2)} ج
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          {sales.length} عملية بيع
        </p>
      </div>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-white outline-none"
      />

      {loading ? (
        <div className="p-8 text-center text-zinc-400">
          جارِ التحميل...
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          لا توجد مبيعات في هذا اليوم
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
                  {new Date(sale.created_at).toLocaleTimeString("ar-EG", {
                    hour: "2-digit",
                    minute: "2-digit",
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
