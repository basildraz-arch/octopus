"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getItems } from "@/repositories/item.repository";
import { getOpenShift, type Shift } from "@/repositories/shift.repository";
import {
  getReportSummary,
  type ReportSummary,
} from "@/repositories/report.repository";
import { getWarehouses } from "@/repositories/warehouse.repository";
import {
  getRecentTransfers,
  type StockTransferWithDetails,
} from "@/repositories/stockTransfer.repository";
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
  const { user, business, hasFeature } = useSession();

  const [items, setItems] = useState<Item[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [todayReport, setTodayReport] = useState<ReportSummary | null>(null);
  const [warehouseCount, setWarehouseCount] = useState(0);
  const [recentTransfers, setRecentTransfers] = useState<
    StockTransferWithDetails[]
  >([]);
  const [loading, setLoading] = useState(true);

  const isWarehouseManagement = hasFeature("multi_warehouse");

  useEffect(() => {
    if (!user || !business) return;

    load();
  }, [user, business]);

  async function load() {
    if (!user) return;

    setLoading(true);

    if (isWarehouseManagement) {
      const [itemsData, warehouses, transfers] = await Promise.all([
        getItems(),
        getWarehouses(user.business_id),
        getRecentTransfers(user.business_id),
      ]);

      setItems(itemsData);
      setWarehouseCount(warehouses.filter((w) => w.active).length);
      setRecentTransfers(transfers);
    } else {
      const today = todayString();

      const [itemsData, openShift, report] = await Promise.all([
        getItems(),
        getOpenShift(user.business_id),
        getReportSummary(user.business_id, today, today),
      ]);

      setItems(itemsData);
      setShift(openShift);
      setTodayReport(report);
    }

    setLoading(false);
  }

  const totalStockValue = items.reduce((sum, item) => {
    if (!item.has_stock) return sum;

    return sum + item.stock * item.buy_price;
  }, 0);

  if (loading) {
    return (
      <main className="p-8 text-center text-mist">
        جارِ التحميل...
      </main>
    );
  }

  if (isWarehouseManagement) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            🐙 الرئيسية
          </h1>

          <p className="mt-1 text-mist">
            نظرة سريعة على مخازنك
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
            <p className="text-sm text-mist">
              عدد المخازن
            </p>

            <h3 className="mt-2 text-3xl font-bold">
              {warehouseCount}
            </h3>
          </div>

          <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
            <p className="text-sm text-mist">
              عدد الأصناف
            </p>

            <h3 className="mt-2 text-3xl font-bold">
              {items.length}
            </h3>
          </div>
        </div>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <p className="text-sm text-mist">
            قيمة المخزون
          </p>

          <h2 className="mt-2 text-4xl font-bold text-green-400">
            {totalStockValue.toFixed(2)} ج
          </h2>
        </div>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="mb-4 text-lg font-bold">
            🔀 آخر عمليات النقل
          </h2>

          {recentTransfers.length === 0 ? (
            <p className="text-mist">
              لا توجد عمليات نقل بعد
            </p>
          ) : (
            <div className="space-y-3">
              {recentTransfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="rounded-lg border border-ink-600 bg-ink-950 p-3 text-sm"
                >
                  <div className="flex justify-between">
                    <span className="font-semibold">
                      {transfer.items?.name ?? "صنف محذوف"}
                    </span>

                    <span className="text-mist">
                      {new Date(transfer.created_at).toLocaleDateString(
                        "ar-EG"
                      )}
                    </span>
                  </div>

                  <p className="mt-1 text-mist">
                    {transfer.quantity} {transfer.items?.unit ?? ""} من "
                    {transfer.from_warehouse?.name ?? "؟"}" إلى "
                    {transfer.to_warehouse?.name ?? "؟"}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/warehouses"
            className="rounded-xl bg-splash p-4 text-center font-semibold text-ink-950 transition hover:bg-splash-deep"
          >
            🏭 المخازن
          </Link>

          <Link
            href="/items"
            className="rounded-xl bg-ink-700 p-4 text-center font-semibold text-paper transition hover:bg-ink-600"
          >
            📦 الأصناف
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          🐙 الرئيسية
        </h1>

        <p className="mt-1 text-mist">
          نظرة سريعة على محلك
        </p>
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-mist">
            حالة اليوم
          </p>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              shift
                ? "bg-green-600 text-white"
                : "bg-ink-600 text-mist"
            }`}
          >
            {shift ? "مفتوح" : "لسه ما بدأش"}
          </span>
        </div>

        <h2 className="mt-2 text-4xl font-bold text-green-400">
          {(todayReport?.totalSales ?? 0).toFixed(2)} ج
        </h2>

        <p className="mt-1 text-sm text-mist">
          {todayReport?.saleCount ?? 0} عملية بيع لحد دلوقتي
        </p>

        {shift && todayReport && (
          <div className="mt-3 border-t border-ink-600 pt-3">
            <p className="text-sm text-mist">
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
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <p className="text-sm text-mist">
            عدد الأصناف
          </p>

          <h3 className="mt-2 text-2xl font-bold">
            {items.length}
          </h3>
        </div>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <p className="text-sm text-mist">
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
          className="rounded-xl bg-splash p-4 text-center font-semibold text-ink-950 transition hover:bg-splash-deep"
        >
          📒 سجل المبيعات
        </Link>

        <Link
          href="/day-close"
          className="rounded-xl bg-ink-700 p-4 text-center font-semibold text-paper transition hover:bg-ink-600"
        >
          🔒 إنهاء اليوم
        </Link>

        <Link
          href="/purchases"
          className="rounded-xl bg-ink-700 p-4 text-center font-semibold text-paper transition hover:bg-ink-600"
        >
          🚚 تزويد المخزون
        </Link>

        <Link
          href="/reports"
          className="rounded-xl bg-ink-700 p-4 text-center font-semibold text-paper transition hover:bg-ink-600"
        >
          📊 التقارير
        </Link>
      </div>
    </main>
  );
}
