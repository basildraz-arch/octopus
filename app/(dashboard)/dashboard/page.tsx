"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getItems } from "@/repositories/item.repository";
import {
  getOpenShift,
  getShiftSummary,
  type Shift,
  type ShiftSummary,
} from "@/repositories/shift.repository";
import { useSession } from "@/hooks/useSession";

import type { Item } from "@/types/item";

export default function DashboardHomePage() {
  const { user } = useSession();

  const [items, setItems] = useState<Item[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    load();
  }, [user]);

  async function load() {
    if (!user) return;

    setLoading(true);

    const [itemsData, openShift] = await Promise.all([
      getItems(),
      getOpenShift(user.business_id),
    ]);

    setItems(itemsData);
    setShift(openShift);

    if (openShift) {
      const s = await getShiftSummary(openShift.id);
      setSummary(s);
    } else {
      setSummary(null);
    }

    setLoading(false);
  }

  const totalStockValue = items.reduce((sum, item) => {
    if (!item.has_stock) return sum;

    return sum + item.stock * item.buy_price;
  }, 0);

  if (loading) {
    return (
      <main className="p-8 text-center text-zinc-400">
        جارِ التحميل...
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          🐙 الرئيسية
        </h1>

        <p className="mt-1 text-zinc-400">
          نظرة سريعة على محلك
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            حالة اليوم
          </p>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              shift
                ? "bg-green-600 text-white"
                : "bg-zinc-700 text-zinc-300"
            }`}
          >
            {shift ? "مفتوح" : "لسه ما بدأش"}
          </span>
        </div>

        <h2 className="mt-2 text-4xl font-bold text-green-400">
          {(summary?.totalSales ?? 0).toFixed(2)} ج
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          {summary?.saleCount ?? 0} عملية بيع لحد دلوقتي
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            عدد الأصناف
          </p>

          <h3 className="mt-2 text-2xl font-bold">
            {items.length}
          </h3>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            قيمة المخزون
          </p>

          <h3 className="mt-2 text-2xl font-bold text-green-400">
            {totalStockValue.toFixed(2)} ج
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/sales-log"
          className="rounded-xl bg-blue-600 p-4 text-center font-semibold text-white transition hover:bg-blue-700"
        >
          📒 سجل المبيعات
        </Link>

        <Link
          href="/day-close"
          className="rounded-xl bg-zinc-800 p-4 text-center font-semibold text-white transition hover:bg-zinc-700"
        >
          🔒 إنهاء اليوم
        </Link>
      </div>
    </main>
  );
}
