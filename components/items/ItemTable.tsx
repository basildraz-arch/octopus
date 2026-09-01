"use client";

import Link from "next/link";
import {
  Package,
  Sparkles,
  Pencil,
  Pause,
  Play,
  FlaskConical,
  ChefHat,
} from "lucide-react";

import type { Item } from "@/types/item";

type Props = {
  products: Item[];
  onToggleActive: (item: Item) => void;

  // أرقام الأصناف اللي ليها وصفة. بتتحسب مرة في الصفحة الأم بدل
  // استعلام لكل سطر.
  withRecipe?: Set<string>;
};

// ============================================================
// حالة الصنف في كلمة واحدة
// ============================================================
//
// الحالة كانت تلات احتمالات (متوقف / قليل / متوفر). وبعد المكوّنات
// والوصفات بقى فيه أربع حاجات مختلفة الواحد محتاج يعرفها من نظرة:
//
//   متوقف   → مش بيتباع ولا بيظهر لحد
//   مكوّن   → بيتخصم من وصفة، مش بيظهر للكاشير
//   قليل    → المخزون وصل للحد الأدنى
//   متوفر   → عادي
//
// **الترتيب هنا مهم**: "متوقف" بيغلب كل حاجة، و"مكوّن" بيغلب
// "قليل" - لأن مكوّن مخزونه قليل، الرسالة الأهم إنه مكوّن (وde
// بيفسّر ليه مش في شاشة البيع)، مش إنه قليل.
function statusOf(item: Item): { label: string; className: string } {
  if (!item.active) {
    return { label: "متوقف", className: "bg-ink-600 text-mist" };
  }

  if (item.is_ingredient) {
    return { label: "مكوّن", className: "bg-splash-dim text-splash" };
  }

  if (item.has_stock && item.stock <= item.minimum_stock) {
    return { label: "قليل", className: "bg-red-600 text-white" };
  }

  return { label: "متوفر", className: "bg-green-600 text-white" };
}

function TypeIcon({ item }: { item: Item }) {
  if (item.item_type === "service") return <Sparkles size={14} />;
  if (item.is_ingredient) return <FlaskConical size={14} />;

  return <Package size={14} />;
}

function typeLabel(item: Item) {
  if (item.item_type === "service") return "خدمة";
  if (item.is_ingredient) return "مكوّن";

  return "منتج";
}

// المخزون والحد الأدنى في خانة واحدة.
//
// كانوا عمودين. والحد الأدنى **مالوش معنى لوحده** - هو بيتقري
// بالنسبة للمخزون بس ("١٢ والحد ٥" تتقري أسرع من رقمين في عمودين
// بعيدين عن بعض).
function stockText(item: Item) {
  if (!item.has_stock) return "—";

  if (item.minimum_stock > 0) {
    return `${item.stock} · الحد ${item.minimum_stock}`;
  }

  return String(item.stock);
}

export default function ProductTable({
  products,
  onToggleActive,
  withRecipe,
}: Props) {
  if (products.length === 0) {
    return <div className="p-8 text-center text-mist">لا توجد أصناف.</div>;
  }

  return (
    <>
      {/* موبايل: كروت */}
      <div className="space-y-3 p-3 md:hidden">
        {products.map((item) => {
          const status = statusOf(item);
          const hasRecipe = withRecipe?.has(item.id);

          return (
            <div
              key={item.id}
              className="rounded-xl border border-ink-600 bg-ink-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-paper">
                    {item.name}
                  </h3>

                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mist">
                    <span className="flex items-center gap-1">
                      <TypeIcon item={item} />
                      {typeLabel(item)}
                    </span>

                    {hasRecipe && (
                      <span className="flex items-center gap-1 text-splash">
                        <ChefHat size={13} />
                        له وصفة
                      </span>
                    )}

                    {item.barcode && <span>{item.barcode}</span>}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${status.className}`}
                >
                  {status.label}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                {/* المكوّن مالوش سعر بيع - عرض رقم فاضي بيوهم إنه
                    بيتباع. */}
                {!item.is_ingredient && (
                  <span className="text-mist">
                    البيع{" "}
                    <span className="font-bold text-green-400">
                      {item.sell_price}
                    </span>
                  </span>
                )}

                {item.has_stock && (
                  <span className="text-mist">
                    المخزون{" "}
                    <span className="font-semibold text-paper">
                      {stockText(item)}
                    </span>{" "}
                    <span className="text-xs">{item.unit}</span>
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  href={`/items/edit/${item.id}`}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-splash text-sm font-semibold text-ink-950 transition hover:bg-splash-deep"
                >
                  <Pencil size={14} />
                  تعديل
                </Link>

                <button
                  onClick={() => onToggleActive(item)}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-paper transition ${
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

      {/* ============================================================
          كمبيوتر: جدول
          ============================================================

          كان **٩ أعمدة**: باركود، اسم، نوع، مخزون، حد أدنى، شرا،
          بيع، حالة، إجراءات.

          بقى **٦**. اللي اتعمل:
          - الباركود نزل تحت الاسم (بيتدوّر عليه بالبحث، مش بالعين)
          - الحد الأدنى دخل جوه خانة المخزون ("١٢ · الحد ٥")
          - عمود الشرا اتشال - **بيرجّع "—" لمعظم الناس أصلًا**
            لأن التكلفة ممنوعة على مستوى العمود، وعمود بيقول "—"
            في كل سطر هو مساحة ضايعة

          والنتيجة إن الأربع أعمدة اللي بتتقري فعلًا بقى ليهم مساحة
          أوسع. */}
      <table className="hidden w-full md:table">
        <thead className="bg-ink-700 text-sm">
          <tr>
            <th className="p-4 text-right">الصنف</th>
            <th className="p-4 text-center">النوع</th>
            <th className="p-4 text-center">المخزون</th>
            <th className="p-4 text-center">سعر البيع</th>
            <th className="p-4 text-center">الحالة</th>
            <th className="p-4 text-center">الإجراءات</th>
          </tr>
        </thead>

        <tbody>
          {products.map((item) => {
            const status = statusOf(item);
            const hasRecipe = withRecipe?.has(item.id);

            return (
              <tr
                key={item.id}
                className="border-t border-ink-600 transition hover:bg-ink-700/40"
              >
                <td className="p-4">
                  <span className="block font-semibold text-paper">
                    {item.name}
                  </span>

                  {(item.barcode || hasRecipe) && (
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-mist">
                      {hasRecipe && (
                        <span className="flex items-center gap-1 text-splash">
                          <ChefHat size={12} />
                          له وصفة
                        </span>
                      )}

                      {item.barcode && <span>{item.barcode}</span>}
                    </span>
                  )}
                </td>

                <td className="p-4">
                  <span className="flex items-center justify-center gap-1.5 text-sm">
                    <TypeIcon item={item} />
                    {typeLabel(item)}
                  </span>
                </td>

                <td className="p-4 text-center text-sm tabular-nums">
                  {stockText(item)}
                  {item.has_stock && (
                    <span className="ms-1 text-xs text-mist">{item.unit}</span>
                  )}
                </td>

                <td className="p-4 text-center font-bold tabular-nums text-green-400">
                  {item.is_ingredient ? (
                    <span className="text-sm font-normal text-mist">
                      مابيتباعش
                    </span>
                  ) : (
                    item.sell_price
                  )}
                </td>

                <td className="p-4 text-center">
                  <span
                    className={`rounded px-3 py-1 text-xs font-semibold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>

                <td className="p-4">
                  <div className="flex justify-center gap-2">
                    <Link
                      href={`/items/edit/${item.id}`}
                      className="flex items-center gap-1.5 rounded-lg bg-splash px-3 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-splash-deep"
                    >
                      <Pencil size={14} />
                      تعديل
                    </Link>

                    <button
                      onClick={() => onToggleActive(item)}
                      aria-label={item.active ? `تعطيل ${item.name}` : `تفعيل ${item.name}`}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-paper transition ${
                        item.active
                          ? "bg-ink-700 hover:bg-ink-600"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {item.active ? <Pause size={14} /> : <Play size={14} />}
                      {item.active ? "تعطيل" : "تفعيل"}
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
