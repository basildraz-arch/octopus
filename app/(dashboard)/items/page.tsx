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

  const lowStockCount = useMemo(
    () => items.filter((i) => i.has_stock && i.stock <= i.minimum_stock).length,
    [items]
  );

  const totalStockValue = useMemo(() => {
    return items.reduce((sum, item) => {
      if (!item.has_stock) return sum;

      return sum + item.stock * (item.buy_price ?? 0);
    }, 0);
  }, [items]);

  return (
    // الترتيب هنا مقصود: الصفحة دي شغلها إنك تلاقي صنف وتعدّله.
    //
    // كانت بتبدأ بأربع أزرار كاملة العرض وتلات كروت إحصائيات - يعني
    // على الموبايل بتنزل خمس شاشات قبل ما تشوف أول منتج. والأسوأ إن
    // "عدد الأصناف" كان مكتوب مرتين: في العنوان وفي كارت لوحده.
    //
    // دلوقتي: زرار واحد (اللي بتستعمله كل يوم)، البحث، الأصناف.
    // والباقي - المخازن والفئات والاستيراد - حاجات بتتظبط مرة كل كام
    // شهر، فمطويّة تحت. نفس نمط <details> المستعمل في الإعدادات
    // والماستر.
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Package size={26} />
          الأصناف
        </h1>

        <Link
          href="/items/new"
          className="flex min-h-11 items-center gap-2 rounded-lg bg-splash px-4 font-semibold text-ink-950 transition hover:bg-splash-deep"
        >
          <Plus size={18} />
          إضافة صنف
        </Link>
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

      {/* سطر واحد بدل تلات كروت. الأرقام اللي بتتقرا بسرعة مش
          محتاجة كارت لكل واحد. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-sm text-mist">
        <span>
          {items.length} صنف
        </span>

        <span className="text-green-400">
          قيمة المخزون {totalStockValue.toFixed(0)} ج
        </span>

        {lowStockCount > 0 && (
          <span className="text-red-400">
            {lowStockCount} قليل
          </span>
        )}
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

      <details className="rounded-xl border border-ink-600 bg-ink-900">
        <summary className="cursor-pointer select-none p-4 font-semibold">
          إعدادات الأصناف
        </summary>

        <div className="flex flex-col gap-2 p-4 pt-0 sm:flex-row">
          <Link
            href="/warehouses"
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-ink-700 px-4 font-semibold transition hover:bg-ink-600"
          >
            <Warehouse size={18} />
            المخازن
          </Link>

          <Link
            href="/categories"
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-ink-700 px-4 font-semibold transition hover:bg-ink-600"
          >
            <Tag size={18} />
            الفئات
          </Link>

          <Link
            href="/import"
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-ink-700 px-4 font-semibold transition hover:bg-ink-600"
          >
            <FileSpreadsheet size={18} />
            استيراد من ملف
          </Link>
        </div>
      </details>
    </main>
  );
}
