"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, Plus, EyeOff } from "lucide-react";

import {
  addComponent,
  getComponents,
  removeComponent,
  type ItemComponentRow,
} from "@/repositories/itemComponent.repository";
import { getItems, updateItem } from "@/repositories/item.repository";
import { getItemCosts } from "@/repositories/itemCost.repository";
import {
  describeQuantity,
  subUnitFor,
  toStoredQuantity,
} from "@/lib/recipeUnits";
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
//
// ============================================================
// الوصفة كانت موجودة ومحدش استعملها ولا مرة
// ============================================================
//
// القاعدة بتخصم المكوّنات صح، والشاشة دي كانت هنا من أسابيع. ورغم
// كده أول عميل حقيقي (قهوة فيها ٤٥ مشروب) عنده **صفر وصفة**، وقال
// "الخلطة مش شغالة". والسبب ماكانش عطل - كانت تلات حيطان:
//
// ١) **الكمية.** البن بالكيلو والكوباية بتاخد ١٨ جرام، يعني كان
//    المطلوب منه يكتب `0.018`. مرة واحدة ممكن. تلات مكوّنات ×
//    ٤٥ مشروب مستحيل، وأول غلطة في مكان العلامة العشرية بتخلّي
//    الكيلو يخلص في خمس كوبايات فالبرنامج يرفض البيع.
//    الحل: يكتب **١٨** ويختار **جرام** (`lib/recipeUnits.ts`).
//
// ٢) **مافيش سبب يفتحها.** كانت مطوية في آخر الصفحة، وشاشة إضافة
//    صنف جديد مافيهاش وصفة خالص - فوهو بيبني قايمة المشروبات
//    كلها مادخلش هنا ولا مرة. الحل: بتتفتح لوحدها للصنف اللي
//    بيتعمل في المحل، وبتقول ليه.
//
// ٣) **مافيش مكسب باين.** "أضف مكوّن" مابيوعدش بحاجة. الحل:
//    أول ما تكمّل الوصفة، الشاشة بتقول **تكلفة الوحدة وربحها
//    الحقيقي** - وde الرقم اللي صاحب المحل بيفتح البرنامج
//    عشانه.
export default function RecipeEditor({ item, businessId }: Props) {
  const toast = useToast();

  const [rows, setRows] = useState<ItemComponentRow[]>([]);
  const [candidates, setCandidates] = useState<Item[]>([]);
  const [costs, setCosts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const [pickedId, setPickedId] = useState("");
  const [quantity, setQuantity] = useState("");

  // `true` = الرقم المكتوب بالوحدة الصغيرة (جرام/مل).
  // بيتظبط لوحده على الوحدة الصغيرة أول ما تختار مكوّن بالكيلو -
  // لأن دي الحالة الشايعة (١٨ جرام بن، مش ١٨ كيلو).
  const [inSubUnit, setInSubUnit] = useState(true);
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

    const [components, allItems, itemCosts] = await Promise.all([
      getComponents(item.id),
      getItems(businessId),
      // اللي مالوش صلاحية يشوف التكلفة بترجعله Map فاضية، فبنخفي
      // سطر التكلفة بدل ما نوري صفر مضلل.
      getItemCosts(),
    ]);

    setRows(components);
    setCosts(itemCosts);

    // المكوّن لازم يكون صنف له مخزون، ومش الصنف نفسه. القاعدة
    // بترفض غير كده بردو - ده مجرد إننا مانعرضش اختيار هيترفض.
    setCandidates(
      allItems.filter((candidate) => candidate.has_stock && candidate.id !== item.id)
    );

    setLoading(false);
  }

  const picked = candidates.find((c) => c.id === pickedId) ?? null;
  const pickedUnit = picked?.unit ?? "";
  const pickedSub = subUnitFor(pickedUnit);

  // الوحدة الافتراضية بتتظبط لما **يتغيّر المكوّن**، مش مع كل رسم
  // للشاشة.
  //
  // الاعتماد على `pickedSub` كان غلط: هو كائن جديد كل رسمة، فالتأثير
  // كان بيشتغل كل مرة ويرجّع الاختيار لـ"جرام" - يعني اللي يختار
  // "كيلو" بإيده كان بيتغيّر تحت إيده وهو بيبص. الاعتماد على النص
  // (وحدة المكوّن) بيخلّي التأثير يشتغل لما الوحدة تتغيّر فعلًا.
  useEffect(() => {
    setInSubUnit(subUnitFor(pickedUnit) !== null);
  }, [pickedUnit]);

  // ============================================================
  // تكلفة الوحدة من الوصفة
  // ============================================================
  //
  // ده الرقم اللي الوصفة موجودة عشانه. من غيره التقرير بيقول ربح
  // مبني على سعر شرا مكتوب بالتخمين - وكيرو فعلًا كتب ٥ و١٠ و٣٠
  // و١٠٠ لمشروباته، وكل حسابات ربحه مبنية عليهم.
  //
  // `null` معناها فيه مكوّن مانعرفش تكلفته (مالوش مشتريات، أو اللي
  // فاتح الشاشة مالوش صلاحية) - فبنسكت بدل ما نجمع صفر ونطلّع ربح
  // أعلى من الحقيقة.
  const recipeCost = useMemo(() => {
    if (rows.length === 0) return null;

    let total = 0;

    for (const row of rows) {
      const unitCost = costs.get(row.component_item_id);

      if (unitCost === undefined) return null;

      total += unitCost * Number(row.quantity);
    }

    return total;
  }, [rows, costs]);

  async function handleAdd() {
    const typed = Number(quantity);

    if (!pickedId) {
      toast.error("اختار المكوّن الأول");
      return;
    }

    if (!Number.isFinite(typed) || typed <= 0) {
      toast.error("اكتب كمية أكبر من صفر");
      return;
    }

    // التحويل لوحدة المكوّن قبل الحفظ: ١٨ جرام من صنف بالكيلو
    // بتتخزّن `0.018`. القاعدة مابتعرفش عن جرام حاجة - وde مقصود،
    // الوحدة الصغيرة مشتقّة مش مخزّنة.
    const stored = toStoredQuantity(typed, picked?.unit, inSubUnit);

    if (stored <= 0) {
      toast.error("الكمية صغيرة أوي - اكتب رقم أكبر");
      return;
    }

    setAdding(true);

    try {
      await addComponent(businessId, item.id, pickedId, stored);

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

  // الصنف اللي بيتعمل في المحل **محتاج** وصفة - من غيرها مالوش
  // تكلفة ولا بيخصم من حاجة. فبنفتحها له لوحدها بدل ما نستنّاه
  // يلاقي قسم مطوي في آخر الصفحة.
  const madeHere = !item.has_stock;
  const openByDefault = rows.length > 0 || madeHere;

  return (
    <details
      className={`rounded-2xl border bg-ink-800 ${
        madeHere && rows.length === 0
          ? "border-splash/60"
          : "border-ink-600"
      }`}
      open={openByDefault}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
        <span>
          <span className="block text-lg font-bold text-paper">
            🍳 الوصفة
          </span>

          <span className="mt-0.5 block text-xs text-mist">
            {rows.length > 0
              ? `${rows.length} مكوّن — البيع بيخصمهم لوحده`
              : madeHere
                ? "الصنف ده بيتعمل عندك — حدّد بياخد كام من كل خامة"
                : "لو الصنف ده بيتعمل من أصناف تانية"}
          </span>
        </span>

        <span className="text-2xl text-mist">‹</span>
      </summary>

      <div className="space-y-4 p-5 pt-0">
        <p className="text-sm text-mist">
          كوباية القهوة بتاخد ١٨ جرام بن؟ اختار البن، اكتب{" "}
          <strong className="text-paper">١٨</strong> وسيب الوحدة على{" "}
          <strong className="text-paper">جرام</strong>. أول ما تبيع
          كوباية، البن بينقص لوحده، والتكلفة بتتحسب من سعر شرا البن
          الحقيقي.
        </p>

        {/* ============================================================
            تكلفة الوحدة وربحها
            ============================================================

            الرقم اللي بيخلّي حد يقعد يدخّل وصفة ٤٥ مشروب. */}
        {recipeCost !== null && (
          <div className="grid gap-3 rounded-xl border border-ink-600 bg-ink-900 p-4 sm:grid-cols-3">
            <div>
              <span className="block text-xs text-mist">
                تكلفة الوحدة من الوصفة
              </span>

              <span className="mt-0.5 block text-lg font-bold text-paper tabular-nums">
                {recipeCost.toFixed(2)} ج
              </span>
            </div>

            <div>
              <span className="block text-xs text-mist">
                بتبيعها بـ
              </span>

              <span className="mt-0.5 block text-lg font-bold text-paper tabular-nums">
                {item.sell_price.toFixed(2)} ج
              </span>
            </div>

            <div>
              <span className="block text-xs text-mist">
                المكسب في الوحدة
              </span>

              <span
                className={`mt-0.5 block text-lg font-bold tabular-nums ${
                  item.sell_price - recipeCost >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {(item.sell_price - recipeCost).toFixed(2)} ج
              </span>
            </div>
          </div>
        )}

        {/* الصنف اللي ليه مخزون خاص **ووصفة** في نفس الوقت: مخزونه
            مابيتحسبش خالص. التحذير ده بيمنع إن حد يفتكر إن الرقم
            اللي شايفه في المخزون بيتابع حاجة. */}
        {item.has_stock && rows.length > 0 && (
          <p className="rounded-xl border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-300">
            الصنف ده عنده وصفة، فمخزونه الخاص مابيتحسبش — المكوّنات بس
            هي اللي بتنقص. لو الصنف ده بتعمله عندك في المحل، افتح
            تعديل الصنف فوق وغيّر «بييجي منين؟» لـ«بعمله هنا».
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
                      {/* بالوحدة اللي بني آدم بيقراها: "١٨ جرام"
                          مش "0.018 كيلو". */}
                      <span className="text-mist tabular-nums">
                        {describeQuantity(
                          Number(row.quantity),
                          row.component?.unit
                        )}
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
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="الكمية"
                className="w-24 rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none placeholder:text-mist"
              />

              {/* الوحدة: بتظهر بس لما يكون فيها اختيار حقيقي.
                  مكوّن بالقطعة مالوش وحدة أصغر، فبنعرض وحدته
                  كنص ثابت بدل قايمة بخيار واحد. */}
              {pickedSub ? (
                <select
                  value={inSubUnit ? "sub" : "base"}
                  onChange={(e) => setInSubUnit(e.target.value === "sub")}
                  aria-label="وحدة الكمية"
                  className="w-24 rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
                >
                  <option value="sub">{pickedSub.name}</option>
                  <option value="base">{picked?.unit}</option>
                </select>
              ) : (
                <span className="min-w-16 px-2 text-sm text-mist">
                  {picked?.unit ?? ""}
                </span>
              )}

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

            {/* بيوري بالظبط الرقم اللي هيتخزّن قبل الحفظ. الشاشة
                اللي بتحوّل في السر بتخلّي الواحد مايثقش في الرقم -
                خصوصًا لو الفرق بين ١٨ و٠.٠١٨. */}
            {picked && Number(quantity) > 0 && (
              <p className="text-xs text-mist">
                هيتسجّل:{" "}
                <strong className="text-paper">
                  {describeQuantity(
                    toStoredQuantity(Number(quantity), picked.unit, inSubUnit),
                    picked.unit
                  )}
                </strong>{" "}
                من {picked.name} في كل {item.unit} من {item.name}
              </p>
            )}

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
