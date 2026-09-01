"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, EyeOff } from "lucide-react";

import {
  addComponent,
  getComponents,
  removeComponent,
  type ItemComponentRow,
} from "@/repositories/itemComponent.repository";
import { getItems, updateItem } from "@/repositories/item.repository";
import { useToast } from "@/hooks/useToast";

import type { Item } from "@/types/item";

type Props = {
  item: Item;
  businessId: string;
};

// محرّر الوصفة.
//
// مركّب لوحده مش جوه ItemForm عن قصد: ItemForm هي `<form>`، وحطّ
// نموذج جوه نموذج HTML غلط - الزراير بتتلخبط وEnter بيبعت الاتنين.
// وكمان الوصفة بتتحفظ فورًا لما تدوس "أضف"، مش مع حفظ الصنف.
export default function RecipeEditor({ item, businessId }: Props) {
  const toast = useToast();

  const [rows, setRows] = useState<ItemComponentRow[]>([]);
  const [candidates, setCandidates] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickedId, setPickedId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [adding, setAdding] = useState(false);

  // المكوّن اللي لسه اتضاف وهو **لسه ظاهر في شاشة الكاشير**.
  // بنسأل بدل ما نقرر: محمصة بن بتبيع كيلو بن للزبون **وكمان**
  // بتعمل منه قهوة - فالبرنامج مايقدرش يعرف.
  const [suggest, setSuggest] = useState<Item | null>(null);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  async function load() {
    setLoading(true);

    const [components, allItems] = await Promise.all([
      getComponents(item.id),
      getItems(),
    ]);

    setRows(components);

    // المكوّن لازم يكون صنف له مخزون، ومش الصنف نفسه. القاعدة
    // بترفض غير كده بردو - ده مجرد إننا مانعرضش اختيار هيترفض.
    setCandidates(
      allItems.filter((candidate) => candidate.has_stock && candidate.id !== item.id)
    );

    setLoading(false);
  }

  async function handleAdd() {
    const value = Number(quantity);

    if (!pickedId) {
      toast.error("اختار المكوّن الأول");
      return;
    }

    if (!Number.isFinite(value) || value <= 0) {
      toast.error("اكتب كمية أكبر من صفر");
      return;
    }

    setAdding(true);

    try {
      const picked = candidates.find((c) => c.id === pickedId) ?? null;

      await addComponent(businessId, item.id, pickedId, value);

      setPickedId("");
      setQuantity("");

      await load();
      toast.success("اتضاف للوصفة");

      // لسه بيظهر للكاشير؟ نعرض الاقتراح مرة واحدة.
      if (picked && !picked.is_ingredient) setSuggest(picked);
    } catch (err) {
      // رسالة القاعدة بالعربي وموجّهة للمستخدم، فبنعرضها زي ما هي
      toast.error(err instanceof Error ? err.message : "تعذر الإضافة");
    } finally {
      setAdding(false);
    }
  }

  async function hideFromTill() {
    if (!suggest) return;

    setHiding(true);

    try {
      await updateItem(suggest.id, { is_ingredient: true });

      toast.success(`${suggest.name} مابقاش يظهر في شاشة الكاشير`);

      setSuggest(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الإخفاء");
    } finally {
      setHiding(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeComponent(id);
      await load();
    } catch (err) {
      console.error(err);
      toast.error("تعذر الحذف");
    }
  }

  if (item.item_type !== "product") return null;

  return (
    <details
      className="rounded-2xl border border-ink-600 bg-ink-800"
      open={rows.length > 0}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
        <span>
          <span className="block text-lg font-bold text-paper">
            🍳 الوصفة
          </span>

          <span className="mt-0.5 block text-xs text-mist">
            {rows.length > 0
              ? `${rows.length} مكوّن — البيع بيخصمهم لوحده`
              : "لو الصنف ده بيتعمل من أصناف تانية"}
          </span>
        </span>

        <span className="text-2xl text-mist">‹</span>
      </summary>

      <div className="space-y-4 p-5 pt-0">
        <p className="text-sm text-mist">
          كوباية القهوة بتاخد ١٨ جرام بن؟ حطّ البن هنا بكمية ٠.٠١٨ لو
          بتحسبه بالكيلو. أول ما تبيع كوباية، البن بينقص لوحده،
          والتكلفة بتتحسب من سعر شرا البن.
        </p>

        {item.has_stock && rows.length > 0 && (
          <p className="rounded-xl border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-300">
            الصنف ده عنده وصفة، فمخزونه الخاص مابيتحسبش — المكوّنات بس
            هي اللي بتنقص. لو ده مش اللي إنت عايزه، امسح المكوّنات.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-mist">جارِ التحميل...</p>
        ) : (
          <>
            {rows.length > 0 && (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-900 p-3"
                  >
                    <span className="text-paper">
                      {row.component?.name ?? "—"}
                    </span>

                    <span className="flex items-center gap-3">
                      <span className="text-mist">
                        {row.quantity} {row.component?.unit ?? ""}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemove(row.id)}
                        className="rounded-lg p-2 text-red-400 transition hover:bg-red-950/40"
                        aria-label="شيل المكوّن"
                      >
                        <Trash2 size={18} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={pickedId}
                onChange={(e) => setPickedId(e.target.value)}
                className="min-w-40 flex-1 rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
              >
                <option value="">اختار مكوّن</option>

                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} ({candidate.unit})
                  </option>
                ))}
              </select>

              <input
                type="number"
                step="0.0001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="الكمية"
                className="w-28 rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none placeholder:text-mist"
              />

              <button
                type="button"
                onClick={handleAdd}
                disabled={adding}
                className="flex items-center gap-2 rounded-xl bg-splash px-4 py-3 font-bold text-ink-950 transition hover:opacity-90 disabled:opacity-50"
              >
                <Plus size={18} />
                أضف
              </button>
            </div>

            {/* الاقتراح بيظهر مرة واحدة بعد إضافة مكوّن لسه ظاهر
                للكاشير. مابنقررش بدل صاحب المحل: محمصة بن بتبيع
                كيلو بن للزبون **وكمان** بتعمل منه قهوة - الاستعمالين
                شرعيين والبرنامج مايقدرش يعرف أنهي واحد ده. */}
            {suggest && (
              <div className="rounded-xl border border-splash/40 bg-ink-900 p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-paper">
                  <EyeOff size={16} />
                  «{suggest.name}» لسه بيظهر في شاشة الكاشير
                </p>

                <p className="mb-3 text-xs text-mist">
                  دلوقتي بقى مكوّن في «{item.name}». لو مش بتبيعه لوحده
                  للزبون، إخفاؤه بيمنع إن حد يبيعه بالغلط من دوسة.
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={hideFromTill}
                    disabled={hiding}
                    className="rounded-lg bg-splash px-4 py-2.5 text-sm font-bold text-ink-950 transition hover:opacity-90 disabled:opacity-50"
                  >
                    {hiding ? "..." : "أيوة، اخفيه من شاشة البيع"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSuggest(null)}
                    disabled={hiding}
                    className="rounded-lg bg-ink-700 px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-ink-600 disabled:opacity-50"
                  >
                    لأ، بابيعه برضه
                  </button>
                </div>
              </div>
            )}

            {candidates.length === 0 && (
              <p className="text-sm text-mist">
                مفيش أصناف ليها مخزون تحطها كمكوّنات. ضيف الخامات
                الأول (البن، اللبن، السكر) وبعدين ارجع هنا.
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}
