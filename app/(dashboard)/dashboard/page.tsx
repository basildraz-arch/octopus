"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getItems } from "@/repositories/item.repository";
import { getOpenShift, type Shift } from "@/repositories/shift.repository";
import {
  getReportSummary,
  type ReportSummary,
} from "@/repositories/report.repository";
import { useSession } from "@/hooks/useSession";

import type { Item } from "@/types/item";

function todayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function DashboardHomePage() {
  const { user } = useSession();

  const [items, setItems] = useState<Item[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [todayReport, setTodayReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    load();
  }, [user]);

  async function load() {
    if (!user) return;

    setLoading(true);

    const today = todayString();

    const [itemsData, openShift, report] = await Promise.all([
      getItems(),
      getOpenShift(user.business_id),
      getReportSummary(user.business_id, today, today),
    ]);

    setItems(itemsData);
    setShift(openShift);
    setTodayReport(report);

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
          {(todayReport?.totalSales ?? 0).toFixed(2)} ج
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          {todayReport?.saleCount ?? 0} عملية بيع لحد دلوقتي
        </p>

        {shift && todayReport && (
          <div className="mt-3 border-t border-zinc-800 pt-3">
            <p className="text-sm text-zinc-400">
              صافي ربح اليوم
            </p>

            <p
              className={`mt-1 text-xl font-bold ${
                todayReport.netProfit >= 0
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {todayReport.netProfit.toFixed(2)} ج
            </p>

            {todayReport.hasIncompleteCostData && (
              <p className="mt-1 text-xs text-amber-400">
                ⚠️ تكلفة بعض المبيعات القديمة مش محسوبة
              </p>
            )}
          </div>
        )}
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

      <div className="grid grid-cols-2 gap-3">
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

        <Link
          href="/purchases"
          className="rounded-xl bg-zinc-800 p-4 text-center font-semibold text-white transition hover:bg-zinc-700"
        >
          🚚 تزويد المخزون
        </Link>

        <Link
          href="/reports"
          className="rounded-xl bg-zinc-800 p-4 text-center font-semibold text-white transition hover:bg-zinc-700"
        >
          📊 التقارير
        </Link>
      </div>
    </main>
  );
}
