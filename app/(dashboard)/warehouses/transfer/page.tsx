"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, ArrowDown } from "lucide-react";

import { getItems } from "@/repositories/item.repository";
import { getWarehouses } from "@/repositories/warehouse.repository";
import {
  getStockByWarehouse,
  type WarehouseStock,
} from "@/repositories/stockBatch.repository";
import { createTransfer } from "@/repositories/stockTransfer.repository";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";

import type { Item } from "@/types/item";
import type { Warehouse } from "@/types/warehouse";

export default function StockTransferPage() {
  const { user } = useSession();
  const toast = useToast();

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
      getItems(user.business_id),
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

    if (!user) return;

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

      toast.success(`اتنقل ${quantityValue} ${selectedItem?.unit ?? ""} بنجاح`);

      setQuantity("");

      const updated = await getStockByWarehouse(selectedItemId);
      setStockByWarehouse(updated);
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : "حدث خطأ أثناء نقل المخزون";

      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="p-8 text-center text-mist">
        جارِ التحميل...
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <ArrowLeftRight size={28} />
          نقل مخزون
        </h1>

        <p className="mt-1 text-mist">
          انقل كمية من صنف بين مخزنين
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-ink-600 bg-ink-800 p-5"
      >
        <div>
          <label className="mb-2 block text-sm text-mist">
            الصنف
          </label>

          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            required
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
          >
            <option value="">اختر صنف...</option>

            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-mist">
            من مخزن
          </label>

          <select
            value={fromWarehouseId}
            onChange={(e) => setFromWarehouseId(e.target.value)}
            required
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
          >
            <option value="">اختر مخزن...</option>

            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>

        {selectedItem && fromWarehouseId && (
          <div className="rounded-lg border border-ink-600 bg-ink-900 p-3 text-center">
            <span className="text-sm text-mist">المتاح في المخزن المصدر: </span>
            <span className="font-bold text-paper">
              {availableInFromWarehouse} {selectedItem.unit}
            </span>
          </div>
        )}

        <div className="flex justify-center text-mist">
          <ArrowDown size={24} />
        </div>

        <div>
          <label className="mb-2 block text-sm text-mist">
            إلى مخزن
          </label>

          <select
            value={toWarehouseId}
            onChange={(e) => setToWarehouseId(e.target.value)}
            required
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
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

        <div>
          <label className="mb-2 block text-sm text-mist">
            الكمية
          </label>

          <input
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !selectedItemId || !fromWarehouseId || !toWarehouseId}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-splash p-4 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50"
        >
          {saving ? (
            "جارِ النقل..."
          ) : (
            <>
              <ArrowLeftRight size={18} />
              نقل المخزون
            </>
          )}
        </button>
      </form>
    </main>
  );
}
