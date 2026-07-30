"use client";

import Link from "next/link";
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
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {item.name}
                  </h3>

                  <p className="mt-1 text-xs text-zinc-400">
                    {item.item_type === "service" ? "💈 خدمة" : "📦 منتج"}
                    {item.barcode ? ` · ${item.barcode}` : ""}
                  </p>
                </div>

                {!item.active ? (
                  <span className="shrink-0 rounded bg-zinc-700 px-2 py-1 text-xs">
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
                <span className="text-zinc-400">
                  البيع:{" "}
                  <span className="font-bold text-green-400">
                    {item.sell_price}
                  </span>
                </span>

                {item.has_stock && (
                  <span className="text-zinc-400">
                    المخزون:{" "}
                    <span className="font-semibold text-white">
                      {item.stock}
                    </span>
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  href={`/items/edit/${item.id}`}
                  className="flex-1 rounded bg-blue-600 px-3 py-2 text-center text-sm text-white hover:bg-blue-700"
                >
                  ✏️ تعديل
                </Link>

                <button
                  onClick={() => onToggleActive(item)}
                  className={`flex-1 rounded px-3 py-2 text-sm text-white transition ${
                    item.active
                      ? "bg-zinc-700 hover:bg-zinc-600"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {item.active ? "⏸ تعطيل" : "▶ تفعيل"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Table */}
      <table className="hidden w-full md:table">
        <thead className="bg-zinc-800">
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
                className="border-t border-zinc-800 hover:bg-zinc-800/40"
              >
                <td className="p-4">
                  {item.barcode || "-"}
                </td>

                <td className="p-4 font-semibold">
                  {item.name}
                </td>

                <td className="p-4 text-center">
                  {item.item_type === "service"
                    ? "💈 خدمة"
                    : "📦 منتج"}
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
                    <span className="rounded bg-zinc-700 px-3 py-1 text-xs">
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
                      className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                    >
                      ✏️ تعديل
                    </Link>

                    <button
                      onClick={() => onToggleActive(item)}
                      className={`rounded px-3 py-1 text-sm text-white transition ${
                        item.active
                          ? "bg-zinc-700 hover:bg-zinc-600"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {item.active ? "⏸ تعطيل" : "▶ تفعيل"}
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
