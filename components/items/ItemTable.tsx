"use client";

import Link from "next/link";
import type { Item } from "@/types/item";

type Props = {
  products: Item[];
};

export default function ProductTable({
  products,
}: Props) {
  if (products.length === 0) {
    return (
      <div className="p-8 text-center">
        لا توجد أصناف.
      </div>
    );
  }

  return (
    <table className="w-full">
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

                  <button className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700">
                    🗑 حذف
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}