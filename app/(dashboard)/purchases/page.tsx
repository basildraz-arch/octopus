"use client";

import { useEffect, useState } from "react";

import { getItems } from "@/repositories/item.repository";
import { createPurchase } from "@/repositories/purchase.repository";
import { useSession } from "@/hooks/useSession";

import type { Item } from "@/types/item";

export default function PurchasesPage() {
  const { user } = useSession();

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
      setBuyPrice(String(item.buy_price));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user || !selectedItem) return;

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
        buyPriceValue
      );

      alert(
        `✅ اتضاف ${quantityValue} ${selectedItem.unit} لمخزون "${selectedItem.name}"`
      );

      setSelectedItemId("");
      setQuantity("");
      setBuyPrice("");

      await load();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ عملية الشراء");
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
          🚚 تزويد المخزون
        </h1>

        <p className="mt-1 text-zinc-400">
          سجّل عملية شراء عشان تضيفها للمخزون
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
            onChange={(e) => handleSelectItem(e.target.value)}
            required
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
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
          <p className="text-sm text-zinc-400">
            المخزون الحالي: {selectedItem.stock} {selectedItem.unit} — سعر
            الشراء الحالي: {selectedItem.buy_price} ج
          </p>
        )}

        <div>
          <label className="mb-2 block text-sm text-zinc-300">
            الكمية اللي اشتريتها
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

        <div>
          <label className="mb-2 block text-sm text-zinc-300">
            سعر الشراء (اختياري لو اتغيّر)
          </label>

          <input
            type="number"
            step="0.01"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            required
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !selectedItem}
          className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "جارِ الحفظ..." : "💾 حفظ الشراء"}
        </button>
      </form>
    </main>
  );
}
