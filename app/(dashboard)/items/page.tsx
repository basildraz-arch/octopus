"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Package, Warehouse, Tag, Plus, Search, FileSpreadsheet } from "lucide-react";

import ProductTable from "@/components/items/ItemTable";

import { getItems, updateItem } from "@/repositories/item.repository";
import { attachCosts } from "@/repositories/itemCost.repository";
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

    // الأصناف بتيجي من غير تكلفة (العمود ممنوع - ميجريشن 069)،
    // وattachCosts بتحطها لو اللي فاتح الصفحة معاه صلاحية.
    const data = await attachCosts(await getItems());

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

      return sum + item.stock * (item.buy_price ?? 0);
    }, 0);
  }, [items]);

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Package size={28} />
            إدارة الأصناف
          </h1>

          <p className="mt-1 text-mist">
            إجمالي الأصناف: {items.length}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/warehouses"
            className="flex items-center justify-center gap-2 rounded-lg bg-ink-700 px-5 py-3 text-center font-semibold transition hover:bg-ink-600"
          >
            <Warehouse size={18} />
            إدارة المخازن
          </Link>

          <Link
            href="/categories"
            className="flex items-center justify-center gap-2 rounded-lg bg-ink-700 px-5 py-3 text-center font-semibold transition hover:bg-ink-600"
          >
            <Tag size={18} />
            إدارة الفئات
          </Link>

          <Link
            href="/import"
            className="flex items-center justify-center gap-2 rounded-lg bg-ink-700 px-5 py-3 text-center font-semibold transition hover:bg-ink-600"
          >
            <FileSpreadsheet size={18} />
            استيراد من ملف
          </Link>

          <Link
            href="/items/new"
            className="flex items-center justify-center gap-2 rounded-lg bg-splash px-5 py-3 text-center font-semibold text-ink-950 transition hover:bg-splash-deep"
          >
            <Plus size={18} />
            إضافة صنف
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <p className="text-sm text-mist">
            عدد الأصناف
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            {items.length}
          </h2>
        </div>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <p className="text-sm text-mist">
            قيمة المخزون
          </p>

          <h2 className="mt-2 text-3xl font-bold text-green-400">
            {totalStockValue.toFixed(2)} ج
          </h2>
        </div>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <p className="text-sm text-mist">
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

      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-mist"
        />

        <input
          className="w-full rounded-xl border border-ink-600 bg-ink-800 p-4 pr-11 outline-none"
          placeholder="ابحث باسم الصنف أو الباركود..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-600 bg-ink-800">
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
