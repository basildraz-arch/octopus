"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ProductTable from "@/components/items/ItemTable";

import { getItems, updateItem } from "@/repositories/item.repository";
import type { Item } from "@/types/item";

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);

    const data = await getItems();

    setItems(data);

    setLoading(false);
  }

  async function handleToggleActive(item: Item) {
    await updateItem(item.id, { active: !item.active });
    await loadItems();
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const value = `${item.name} ${item.barcode ?? ""}`.toLowerCase();

      return value.includes(search.toLowerCase());
    });
  }, [items, search]);

  const totalStockValue = useMemo(() => {
    return items.reduce((sum, item) => {
      if (!item.has_stock) return sum;

      return sum + item.stock * item.buy_price;
    }, 0);
  }, [items]);

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            📦 إدارة الأصناف
          </h1>

          <p className="mt-1 text-zinc-400">
            إجمالي الأصناف: {items.length}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/categories"
            className="rounded-lg bg-zinc-700 px-5 py-3 font-semibold transition hover:bg-zinc-600"
          >
            🏷️ إدارة الفئات
          </Link>

          <Link
            href="/items/new"
            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold transition hover:bg-blue-700"
          >
            ➕ إضافة صنف
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            عدد الأصناف
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            {items.length}
          </h2>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            قيمة المخزون
          </p>

          <h2 className="mt-2 text-3xl font-bold text-green-400">
            {totalStockValue.toFixed(2)} ج
          </h2>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">
            أصناف قليلة
          </p>

          <h2 className="mt-2 text-3xl font-bold text-red-400">
            {
              items.filter(
                (i) =>
                  i.has_stock &&
                  i.stock <= i.minimum_stock
              ).length
            }
          </h2>
        </div>
      </div>

      <input
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 outline-none"
        placeholder="🔍 ابحث باسم الصنف أو الباركود..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {loading ? (
          <div className="p-8 text-center">
            جار تحميل الأصناف...
          </div>
        ) : (
          <ProductTable
            products={filteredItems}
            onToggleActive={handleToggleActive}
          />
        )}
      </div>
    </main>
  );
}