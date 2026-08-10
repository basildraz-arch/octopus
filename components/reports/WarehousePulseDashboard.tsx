"use client";

import { useEffect, useState } from "react";

import {
  getWarehouseStockSummary,
  getActivityFeed,
  type WarehouseValueSummary,
  type ActivityEvent,
} from "@/repositories/warehouseActivity.repository";
import { getWarehouses } from "@/repositories/warehouse.repository";
import { getItems } from "@/repositories/item.repository";
import { useSession } from "@/hooks/useSession";

import type { Warehouse } from "@/types/warehouse";
import type { Item } from "@/types/item";

const POLL_INTERVAL_MS = 30000;

function formatRelativeTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "الآن";
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;

  const diffDays = Math.floor(diffHours / 24);
  return `منذ ${diffDays} يوم`;
}

export default function WarehousePulseDashboard() {
  const { user } = useSession();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<WarehouseValueSummary[]>([]);
  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [warehouseId, setWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (!user) return;

    getWarehouses(user.business_id).then(setWarehouses);
    getItems().then(setItems);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    loadData();

    const intervalId = setInterval(loadData, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);

    async function loadData() {
      if (!user) return;

      const filters = {
        warehouseId: warehouseId || undefined,
        itemId: itemId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      };

      const [summaryData, feedData] = await Promise.all([
        getWarehouseStockSummary(user.business_id),
        getActivityFeed(user.business_id, filters),
      ]);

      setSummary(summaryData);
      setFeed(feedData);
      setLoading(false);
    }
  }, [user, warehouseId, itemId, fromDate, toDate]);

  const lastActivity = feed[0];

  if (loading) {
    return (
      <div className="p-8 text-center text-zinc-400">
        جارِ التحميل...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map((warehouse) => (
          <div
            key={warehouse.warehouse_id}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <p className="text-sm text-zinc-400">
              {warehouse.warehouse_name}
            </p>

            <h3 className="mt-2 text-2xl font-bold text-green-400">
              {warehouse.totalValue.toFixed(2)} ج
            </h3>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm text-zinc-400">
          آخر نشاط
        </p>

        {lastActivity ? (
          <p className="mt-2 text-white">
            {lastActivity.type === "transfer"
              ? `🔀 نقل ${lastActivity.quantity} ${lastActivity.itemUnit} من "${lastActivity.itemName}" من "${lastActivity.fromWarehouseName}" إلى "${lastActivity.toWarehouseName}"`
              : `🚚 شراء ${lastActivity.quantity} ${lastActivity.itemUnit} من "${lastActivity.itemName}" إلى "${lastActivity.toWarehouseName}"`}{" "}
            <span className="text-sm text-zinc-500">
              — {formatRelativeTime(lastActivity.createdAt)}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-zinc-500">
            لا يوجد نشاط بعد
          </p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-bold">
          🔍 فلترة
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
          >
            <option value="">كل المخازن</option>

            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>

          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
          >
            <option value="">كل الأصناف</option>

            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-bold">
          📋 سجل النشاط
        </h2>

        {feed.length === 0 ? (
          <p className="text-center text-zinc-400">
            لا توجد عمليات في الفترة المحددة
          </p>
        ) : (
          <div className="space-y-3">
            {feed.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {event.type === "transfer" ? "🔀 نقل" : "🚚 شراء"} —{" "}
                    {event.itemName}
                  </span>

                  <span className="text-xs text-zinc-500">
                    {formatRelativeTime(event.createdAt)}
                  </span>
                </div>

                <p className="mt-1 text-sm text-zinc-400">
                  {event.quantity} {event.itemUnit}
                  {event.type === "transfer"
                    ? ` — من "${event.fromWarehouseName}" إلى "${event.toWarehouseName}"`
                    : ` — إلى "${event.toWarehouseName}"`}
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  بواسطة {event.createdByName}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
