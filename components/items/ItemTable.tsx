"use client";

import Link from "next/link";
import { Package, Sparkles, Pencil, Pause, Play } from "lucide-react";
import type { Item } from "@/types/item";

type Props = {
  products: Item[];
  onToggleActive: (item: Item) => void;
};

export default function ProductTable({
  products,
  onToggleActive,
}: Props) {
  if (products.length === 0) {
    return (
      <div className="p-8 text-center">
        لا توجد أصناف.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Cards */}
      <div className="space-y-3 p-3 md:hidden">
        {products.map((item) => {
          const low =
            item.has_stock &&
            item.stock <= item.minimum_stock;

          return (
            <div
              key={item.id}
              className="rounded-xl border border-ink-600 bg-ink-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {item.name}
                  </h3>

                  <p className="mt-1 flex items-center gap-1 text-xs text-mist">
                    {item.item_type === "service" ? (
                      <Sparkles size={13} />
                    ) : (
                      <Package size={13} />
                    )}
                    {item.item_type === "service" ? "خدمة" : "منتج"}
                    {item.barcode ? ` · ${item.barcode}` : ""}
                  </p>
                </div>

                {!item.active ? (
                  <span className="shrink-0 rounded bg-ink-600 px-2 py-1 text-xs">
                    متوقف
                  </span>
                ) : low ? (
                  <span className="shrink-0 rounded bg-red-600 px-2 py-1 text-xs">
                    قليل
                  </span>
                ) : (
                  <span className="shrink-0 rounded bg-green-600 px-2 py-1 text-xs">
                    متوفر
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-mist">
                  البيع:{" "}
                  <span className="font-bold text-green-400">
                    {item.sell_price}
                  </span>
                </span>

                {item.has_stock && (
                  <span className="text-mist">
                    المخزون:{" "}
                    <span className="font-semibold text-paper">
                      {item.stock}
                    </span>
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  href={`/items/edit/${item.id}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded bg-splash px-3 py-2 text-center text-sm text-ink-950 hover:bg-splash-deep"
                >
                  <Pencil size={14} />
                  تعديل
                </Link>

                <button
                  onClick={() => onToggleActive(item)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-sm text-paper transition ${
                    item.active
                      ? "bg-ink-700 hover:bg-ink-600"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {item.active ? (
                    <>
                      <Pause size={14} />
                      تعطيل
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      تفعيل
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Table */}
      <table className="hidden w-full md:table">
        <thead className="bg-ink-700">
          <tr>
            <th className="p-4 text-right">الباركود</th>
            <th className="p-4 text-right">اسم الصنف</th>
            <th className="p-4 text-center">النوع</th>
            <th className="p-4 text-center">المخزون</th>
            <th className="p-4 text-center">الحد الأدنى</th>
            <th className="p-4 text-center">شراء</th>
            <th className="p-4 text-center">بيع</th>
            <th className="p-4 text-center">الحالة</th>
            <th className="p-4 text-center">الإجراءات</th>
          </tr>
        </thead>

        <tbody>
          {products.map((item) => {
            const low =
              item.has_stock &&
              item.stock <= item.minimum_stock;

            return (
              <tr
                key={item.id}
                className="border-t border-ink-600 hover:bg-ink-700/40"
              >
                <td className="p-4">
                  {item.barcode || "-"}
                </td>

                <td className="p-4 font-semibold">
                  {item.name}
                </td>

                <td className="p-4">
                  <div className="flex items-center justify-center gap-1.5">
                    {item.item_type === "service" ? (
                      <Sparkles size={15} />
                    ) : (
                      <Package size={15} />
                    )}
                    {item.item_type === "service" ? "خدمة" : "منتج"}
                  </div>
                </td>

                <td className="p-4 text-center">
                  {item.has_stock ? item.stock : "-"}
                </td>

                <td className="p-4 text-center">
                  {item.has_stock
                    ? item.minimum_stock
                    : "-"}
                </td>

                <td className="p-4 text-center">
                  {item.buy_price}
                </td>

                <td className="p-4 text-center font-bold text-green-400">
                  {item.sell_price}
                </td>

                <td className="p-4 text-center">
                  {!item.active ? (
                    <span className="rounded bg-ink-600 px-3 py-1 text-xs">
                      متوقف
                    </span>
                  ) : low ? (
                    <span className="rounded bg-red-600 px-3 py-1 text-xs">
                      قليل
                    </span>
                  ) : (
                    <span className="rounded bg-green-600 px-3 py-1 text-xs">
                      متوفر
                    </span>
                  )}
                </td>

                <td className="p-4">
                  <div className="flex justify-center gap-2">
                    <Link
                      href={`/items/edit/${item.id}`}
                      className="flex items-center gap-1.5 rounded bg-splash px-3 py-1 text-sm text-ink-950 hover:bg-splash-deep"
                    >
                      <Pencil size={14} />
                      تعديل
                    </Link>

                    <button
                      onClick={() => onToggleActive(item)}
                      className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm text-paper transition ${
                        item.active
                          ? "bg-ink-700 hover:bg-ink-600"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {item.active ? (
                        <>
                          <Pause size={14} />
                          تعطيل
                        </>
                      ) : (
                        <>
                          <Play size={14} />
                          تفعيل
                        </>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
