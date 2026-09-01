"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Warehouse, ArrowLeftRight } from "lucide-react";

import {
  getStockByWarehouse,
  type WarehouseStock,
} from "@/repositories/stockBatch.repository";
import type { Item } from "@/types/item";

type Props = {
  item: Item;
};

// "كام في المخزن وكام معروض في المحل؟"
//
// ============================================================
// السؤال ده كان مالوش إجابة في مكان واحد
// ============================================================
//
// كيرو طلب "فصل المخزن عن المعروض في المحل". والآلية موجودة من
// زمان: مخازن متعددة + نقل بينها. اللي كان ناقص إن **الرقم مكانش
// بيتقسّم في أي شاشة**.
//
// `stock_by_warehouse` كانت موجودة وبتتنادى من شاشة النقل بس -
// يعني عشان تعرف التوزيع، لازم تفتح شاشة نقل بضاعة وتختار الصنف.
// وde سؤال بيتسأل كل يوم، وشاشة النقل مش مكانه.
//
// **بتختفي لما يكون فيه مخزن واحد.** مفيش معنى لجدول توزيع من سطر
// واحد؛ الرقم الإجمالي فوق كافي.
export default function StockByWarehouse({ item }: Props) {
  const [rows, setRows] = useState<WarehouseStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getStockByWarehouse(item.id)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item.id]);

  // خدمة أو صنف بوصفة: مالوش مخزون خاص بيه.
  if (!item.has_stock) return null;

  if (loading) return null;

  // مخزن واحد = مفيش توزيع يتعرض.
  if (rows.length <= 1) return null;

  const total = rows.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <Warehouse size={18} />
        الكمية موجودة فين
      </h2>

      <p className="mb-4 text-sm text-mist">
        إجمالي {total} {item.unit} موزّعين كده:
      </p>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.warehouse_id}
            className="flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-900 p-3"
          >
            <span className="min-w-0 truncate text-sm font-semibold text-paper">
              {row.warehouse_name}
            </span>

            <span className="shrink-0">
              <span
                className={`font-bold ${
                  row.quantity <= 0 ? "text-red-400" : "text-paper"
                }`}
              >
                {row.quantity}
              </span>{" "}
              <span className="text-xs text-mist">{item.unit}</span>
            </span>
          </div>
        ))}
      </div>

      {/* الرابط للنقل هنا لأن ده المكان اللي الواحد بيكتشف فيه إن
          المحل فاضي والمخزن مليان. */}
      <Link
        href="/warehouses/transfer"
        className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-ink-700 p-3 text-sm font-semibold text-paper transition hover:bg-ink-600"
      >
        <ArrowLeftRight size={15} />
        انقل بضاعة بين المخازن
      </Link>
    </div>
  );
}
