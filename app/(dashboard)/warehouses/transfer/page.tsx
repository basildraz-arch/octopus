"use client";

import { useEffect, useState } from "react";

import { getItems } from "@/repositories/item.repository";
import { getWarehouses } from "@/repositories/warehouse.repository";
import {
  getStockByWarehouse,
  type WarehouseStock,
} from "@/repositories/stockBatch.repository";
import { createTransfer } from "@/repositories/stockTransfer.repository";
import { useSession } from "@/hooks/useSession";

import type { Item } from "@/types/item";
import type { Warehouse } from "@/types/warehouse";

export default function StockTransferPage() {
  const { user } = useSession();

  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  const [stockByWarehouse, setStockByWarehouse] = useState<WarehouseStock[]>([]);

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    if (!user) return;

    setLoading(true);

    const [itemsData, warehousesData] = await Promise.all([
      getItems(),
      getWarehouses(user.business_id),
    ]);

    setItems(itemsData.filter((item) => item.item_type === "product"));
    setWarehouses(warehousesData.filter((w) => w.active));

    setLoading(false);
  }

  useEffect(() => {
    if (!selectedItemId) {
      setStockByWarehouse([]);
      return;
    }

    getStockByWarehouse(selectedItemId).then(setStockByWarehouse);
  }, [selectedItemId]);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

  const availableInFromWarehouse =
    stockByWarehouse.find((s) => s.warehouse_id === fromWarehouseId)?.quantity ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user || !selectedItemId || !fromWarehouseId || !toWarehouseId) return;

    const quantityValue = Number(quantity);

    if (!quantityValue || quantityValue <= 0) return;

    setSaving(true);

    try {
      await createTransfer(
        user.business_id,
        user.id,
        selectedItemId,
        fromWarehouseId,
        toWarehouseId,
        quantityValue
      );

      alert(`✅ اتنقل ${quantityValue} ${selectedItem?.unit ?? ""} بنجاح`);

      setQuantity("");

      const updated = await getStockByWarehouse(selectedItemId);
      setStockByWarehouse(updated);
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : "حدث خطأ أثناء نقل المخزون";

      alert(message);
    } finally {
      setSaving(false);
    }
  }

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
          🔀 نقل مخزون
        </h1>

        <p className="mt-1 text-zinc-400">
          انقل كمية من صنف بين مخزنين
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <div>
          <label className="mb-2 block text-sm text-zinc-300">
            الصنف
          </label>

          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            required
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
          >
            <option value="">اختر صنف...</option>

            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              من مخزن
            </label>

            <select
              value={fromWarehouseId}
              onChange={(e) => setFromWarehouseId(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
            >
              <option value="">اختر مخزن...</option>

              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              إلى مخزن
            </label>

            <select
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
            >
              <option value="">اختر مخزن...</option>

              {warehouses
                .filter((warehouse) => warehouse.id !== fromWarehouseId)
                .map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {selectedItem && fromWarehouseId && (
          <p className="text-sm text-zinc-400">
            المتاح في المخزن المصدر: {availableInFromWarehouse} {selectedItem.unit}
          </p>
        )}

        <div>
          <label className="mb-2 block text-sm text-zinc-300">
            الكمية
          </label>

          <input
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !selectedItemId || !fromWarehouseId || !toWarehouseId}
          className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "جارِ النقل..." : "🔀 نقل المخزون"}
        </button>
      </form>
    </main>
  );
}
