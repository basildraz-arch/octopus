"use client";

import { useEffect, useState } from "react";
import { Truck, Save } from "lucide-react";

import { getItems } from "@/repositories/item.repository";
import { createPurchase } from "@/repositories/purchase.repository";
import { useSession } from "@/hooks/useSession";
import { useWarehouseSelection } from "@/hooks/useWarehouseSelection";
import { useToast } from "@/hooks/useToast";

import type { Item } from "@/types/item";

export default function PurchasesPage() {
  const { user } = useSession();
  const { warehouses, selectedWarehouseId, selectWarehouse } =
    useWarehouseSelection(user?.business_id);
  const toast = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const data = await getItems();

    setItems(data);

    setLoading(false);
  }

  const products = items.filter((item) => item.item_type === "product");

  const selectedItem =
    products.find((item) => item.id === selectedItemId) ?? null;

  function handleSelectItem(id: string) {
    setSelectedItemId(id);

    const item = products.find((i) => i.id === id);

    if (item) {
      setBuyPrice(item.buy_price === undefined ? "" : String(item.buy_price));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user || !selectedItem || !selectedWarehouseId) return;

    const quantityValue = Number(quantity);
    const buyPriceValue = Number(buyPrice);

    if (!quantityValue || quantityValue <= 0) return;
    if (!buyPriceValue || buyPriceValue < 0) return;

    setSaving(true);

    try {
      await createPurchase(
        user.business_id,
        user.id,
        selectedItem,
        quantityValue,
        buyPriceValue,
        selectedWarehouseId
      );

      toast.success(
        `اتضاف ${quantityValue} ${selectedItem.unit} لمخزون "${selectedItem.name}"`
      );

      setSelectedItemId("");
      setQuantity("");
      setBuyPrice("");

      await load();
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء حفظ عملية الشراء");
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
          <Truck size={28} />
          تزويد المخزون
        </h1>

        <p className="mt-1 text-mist">
          سجّل عملية شراء عشان تضيفها للمخزون
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-ink-600 bg-ink-800 p-5"
      >
        {warehouses.length > 1 && (
          <div>
            <label className="mb-2 block text-sm text-mist">
              المخزن
            </label>

            <select
              value={selectedWarehouseId}
              onChange={(e) => selectWarehouse(e.target.value)}
              required
              className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm text-mist">
            الصنف
          </label>

          <select
            value={selectedItemId}
            onChange={(e) => handleSelectItem(e.target.value)}
            required
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
          >
            <option value="">اختر صنف...</option>

            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {selectedItem && (
          <p className="text-sm text-mist">
            المخزون الحالي: {selectedItem.stock} {selectedItem.unit} — سعر
            الشراء الحالي: {selectedItem.buy_price ?? "—"} ج
          </p>
        )}

        <div>
          <label className="mb-2 block text-sm text-mist">
            الكمية اللي اشتريتها
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

        <div>
          <label className="mb-2 block text-sm text-mist">
            سعر الشراء (اختياري لو اتغيّر)
          </label>

          <input
            type="number"
            step="0.01"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            required
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !selectedItem || !selectedWarehouseId}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-splash p-3 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50"
        >
          {saving ? (
            "جارِ الحفظ..."
          ) : (
            <>
              <Save size={18} />
              حفظ الشراء
            </>
          )}
        </button>
      </form>
    </main>
  );
}
