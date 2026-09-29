"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Save, ScanBarcode, Sparkles } from "lucide-react";

import {
  createItem,
  updateItem,
  adjustItemStock,
  findItemByName,
  getItems,
} from "@/repositories/item.repository";
import { logActivity } from "@/repositories/activity.repository";
import {
  getCategories,
  type Category,
} from "@/repositories/category.repository";
import { getWarehouses } from "@/repositories/warehouse.repository";
import { getStockByWarehouse } from "@/repositories/stockBatch.repository";
import { getItemCost } from "@/repositories/itemCost.repository";
import { useSession } from "@/hooks/useSession";
import { getExampleHints } from "@/lib/examples";
import { hasFeature } from "@/lib/features";
import { tierLabel } from "@/lib/priceTier";
import BarcodeScanner from "@/components/pos/BarcodeScanner";
import { makeInStoreBarcode } from "@/lib/barcode";
import { useToast } from "@/hooks/useToast";

import { itemSchema, ItemSchema } from "./validation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import type { Item } from "@/types/item";

type Props = {
  item?: Item;
};

export default function ItemForm({ item }: Props) {
  const router = useRouter();
  const { user, business } = useSession();

  // Examples drawn from this shop's trade rather than generic ones.
  const hints = getExampleHints(business);
  const toast = useToast();

  // التسعيرات التلاتة ميزة اختيارية. المحل اللي مافعّلهاش بيشوف
  // خانة سعر واحدة زي ما هو - مش تلاتة فاضيين بيسألوا عن حاجة
  // مالهاش لازمة عنده.
  const tiersEnabled = hasFeature(business, "price_tiers");

  // الكاميرا مفتوحة عشان تقرا باركود الصنف.
  const [scanningBarcode, setScanningBarcode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const tierLabels = business?.price_tier_labels;

  const [categories, setCategories] = useState<Category[]>([]);
  const [duplicateItem, setDuplicateItem] = useState<Item | null>(null);
  const [warehouseStocks, setWarehouseStocks] = useState<
    { warehouse_id: string; warehouse_name: string; quantity: number }[]
  >([]);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!item || !user) return;

    Promise.all([
      getWarehouses(user.business_id),
      getStockByWarehouse(item.id),
    ]).then(([warehouses, stocks]) => {
      const active = warehouses.filter((w) => w.active);

      if (active.length <= 1) {
        setWarehouseStocks([]);
        return;
      }

      setWarehouseStocks(
        active.map((warehouse) => ({
          warehouse_id: warehouse.id,
          warehouse_name: warehouse.name,
          quantity:
            stocks.find((s) => s.warehouse_id === warehouse.id)?.quantity ?? 0,
        }))
      );
    });
  }, [item, user]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ItemSchema>({
    resolver: zodResolver(itemSchema),

    defaultValues: item
      ? {
          name: item.name,
          barcode: item.barcode ?? "",
          category_id: item.category_id ?? "",

          item_type: item.item_type,
          sale_method: item.sale_method,
          unit: item.unit,

          // بيتملا بعدين من item_costs. القراءة المباشرة ممنوعة
          // (ميجريشن 070) فالقيمة هنا بتبقى undefined دايمًا - وde
          // اللي كان بيخلي الحفظ يمسح تكلفة الصنف.
          buy_price: 0,
          sell_price: item.sell_price,

          // صفر = مش متسعّر. القاعدة بتخزّن null، والنموذج بيعرض
          // خانة فاضية بصفر عشان النوع يفضل رقم.
          sell_price_2: item.sell_price_2 ?? 0,
          sell_price_3: item.sell_price_3 ?? 0,

          stock: item.stock,
          minimum_stock: item.minimum_stock,

          has_stock: item.has_stock ?? true,

          is_ingredient: item.is_ingredient ?? false,
        }
      : {
          name: "",
          barcode: "",
          category_id: "",

          item_type: "product",
          sale_method: "piece",
          unit: "قطعة",

          buy_price: 0,
          sell_price: 0,

          sell_price_2: 0,
          sell_price_3: 0,

          stock: 0,
          minimum_stock: 0,

          // الافتراضي بضاعة جاهزة: ده أغلب الحالات في أغلب المحلات،
          // والمحل اللي بيعمل حاجته بنفسه بيغيّرها بدوسة.
          has_stock: true,

          is_ingredient: false,
        },
  });

  const itemType = watch("item_type");
  const isIngredient = watch("is_ingredient");
  const hasStock = watch("has_stock");
  const name = watch("name");

  // التكلفة الحقيقية لصنف موجود.
  //
  // undefined = لسه بنجيبها أو اللي فاتح الشاشة مالوش صلاحية يشوفها.
  // الفرق بينها وبين صفر مهم: صفر رقم، وundefined معناها "مش من حقك".
  const [realCost, setRealCost] = useState<number | undefined>();

  useEffect(() => {
    if (!item) return;

    getItemCost(item.id).then(setRealCost);
  }, [item]);

  useEffect(() => {
    setDuplicateItem(null);
  }, [name]);

  useEffect(() => {
    if (itemType === "service") {
      setValue("buy_price", 0);
      setValue("unit", "قطعة");
      setValue("sale_method", "piece");
    }
  }, [itemType, setValue]);

  // المكوّن لازم يكون له مخزون - الوصفة بتخصم منه، والقاعدة بترفض
  // مكوّن مالوش مخزون. بنصلّحها لوحدنا بدل ما نوري رسالة غلط عن
  // تناقض إحنا اللي سمحنا بيه.
  useEffect(() => {
    if (isIngredient) setValue("has_stock", true);
  }, [isIngredient, setValue]);

  // الحقول اللي بتختفي لازم تتصفّر مش تفضل شايلة آخر رقم مكتوب.
  //
  // نموذج مخفي بيتبعت بردو. لو حد كتب مخزون ١٠٠ وبعدين غيّر لـ"بعمله
  // هنا"، الـ١٠٠ كانت هتفضل في الحالة وتتحفظ - ونرجع لنفس المشكلة
  // اللي بنصلّحها، بس بشكل مش باين خالص.
  useEffect(() => {
    if (!hasStock) {
      setValue("stock", 0);
      setValue("minimum_stock", 0);
      setValue("buy_price", 0);
    }
  }, [hasStock, setValue]);

  // ============================================================
  // توليد كود داخلي
  // ============================================================
  //
  // بيقرا أكواد المحل الحالية الأول عشان مايكررش. والقاعدة عندها
  // فهرس فريد على (المحل، الباركود) كحزام تاني - فحتى لو اتنين
  // اتولدوا في نفس اللحظة من جهازين، التاني بيترفض عند الحفظ.
  //
  // الكود بيبدأ بـ٢ - النطاق المحجوز عالميًا للاستعمال الداخلي،
  // فمستحيل يتعارض مع باركود منتج حقيقي. التفاصيل في `lib/barcode.ts`.
  async function generateBarcode() {
    if (!user || generating) return;

    setGenerating(true);

    try {
      const existing = await getItems(user.business_id);

      const code = makeInStoreBarcode(
        existing
          .filter((row) => row.id !== item?.id)
          .map((row) => row.barcode ?? "")
      );

      setValue("barcode", code, { shouldDirty: true });
      toast.success("اتولّد كود. احفظ الصنف عشان يتسجّل.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر التوليد");
    } finally {
      setGenerating(false);
    }
  }

  async function onSubmit(values: ItemSchema) {
    if (!item) {
      const existing = await findItemByName(values.name);

      if (existing) {
        setDuplicateItem(existing);
        return;
      }
    }

    // ============================================================
    // صفر في التسعيرة التانية/التالتة معناه «مش متسعّر»
    // ============================================================
    //
    // بيتحوّل لـ`null` عشان `priceForTier` ترجع لسعر البيع العادي.
    // لو اتبعت صفر زي ما هو، الكاشير اللي واقف على التسعيرة دي
    // كان هيبيع الصنف **ببلاش** والفاتورة تتسجّل من غير أي شكوى.
    //
    // ولو الميزة مقفولة للمحل، الحقلين مابيظهروش في الشاشة أصلًا -
    // فبيتحفظوا `null`. ده مقصود: محل مالوش تسعيرات مالوش أسعار
    // تانية، والصفر اللي كان جاي من النموذج المخفي أخطر من الفراغ.
    const tierPrices = {
      sell_price_2:
        tiersEnabled && values.sell_price_2 > 0 ? values.sell_price_2 : null,
      sell_price_3:
        tiersEnabled && values.sell_price_3 > 0 ? values.sell_price_3 : null,
    };

    try {
      if (item) {
        // buy_price بيتشال من التعديل عن قصد.
        //
        // تكلفة صنف موجود بتتحسب من دفعات المخزون (نفس قاعدة stock)،
        // والقاعدة بترفض أي رقم جاي من هنا أصلًا بعد ميجريشن 072.
        // بعتُه هنا ماكانش بيعمل غير إنه يوهم إن الحقل شغال.
        const {
          stock: newStock,
          buy_price: _cost,
          sell_price_2: _t2,
          sell_price_3: _t3,
          ...rest
        } = values;

        void _cost;
        void _t2;
        void _t3;

        // ============================================================
        // المخزون بقى اختيار، مش قدر
        // ============================================================
        //
        // كان مكتوب هنا `has_stock: values.item_type === "product"`،
        // يعني **أي منتج بياخد مخزون بالعافية** ومافيش طريقة
        // تقفلها. صاحب قهوة عنده ٤٥ مشروب اضطر يكتب رقم مخزون من
        // دماغه لكل واحد - وكل رقم منهم بينزل مع كل بيعة لحد ما
        // يوصل صفر والبرنامج يرفض يبيع المشروب.
        //
        // الخدمة بتفضل من غير مخزون زي ما هي: ماتنفعش تتعدّ.
        const tracksStock = values.item_type === "product" && values.has_stock;

        await updateItem(item.id, {
          ...rest,
          ...tierPrices,
          has_stock: tracksStock,
        });

        if (tracksStock && user) {
          await adjustItemStock(user.business_id, item, newStock);
        }

        if (user) {
          await logActivity(user.id, user.business_id);
        }
      } else {
        if (!user) return;

        const madeHere = values.item_type === "product" && !values.has_stock;

        const created = await createItem({
          ...values,

          // بيغطّوا على الصفر الجاي من النموذج - شوف التعليق فوق.
          ...tierPrices,

          // نفس السبب المشروح فوق في فرع التعديل.
          has_stock: values.item_type === "product" && values.has_stock,
          active: true,

          business_id: user.business_id,
          image: undefined,
          keywords: [],
        });

        await logActivity(user.id, user.business_id);

        // ============================================================
        // الصنف اللي بيتعمل في المحل بيروح على الوصفة، مش على القايمة
        // ============================================================
        //
        // محرّر الوصفة موجود في شاشة **تعديل** الصنف بس (لأنه محتاج
        // رقم الصنف عشان يربط بيه المكوّنات). فاللي بيضيف مشروب جديد
        // كان بيترمي على قايمة الأصناف ومايشوف الوصفة أبدًا - وde
        // اللي خلّى ٤٥ مشروب يتبنوا من غير ولا وصفة واحدة.
        //
        // الصنف اللي ليه مخزون بيفضل بيرجع للقايمة زي ما هو: خلّص
        // شغله، ومالوش وصفة لازمة.
        const newId = (created?.[0] as { id?: string } | undefined)?.id;

        if (madeHere && newId) {
          toast.success("اتحفظ. دلوقتي حدّد الوصفة - بياخد كام من كل خامة.");
          router.push(`/items/edit/${newId}`);
          return;
        }
      }

      router.push("/items");
    } catch (err) {
      console.error(err);

      const code = (err as { code?: string })?.code;

      if (code === "23505") {
        toast.error("يوجد صنف بنفس الاسم بالفعل. عدّل الصنف الموجود بدل إضافة واحد جديد.");
      } else {
        toast.error("حدث خطأ أثناء الحفظ");
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-8"
    >
      <div className="grid gap-6 md:grid-cols-2">

        <div>
          <label className="mb-2 block text-sm">
            اسم الصنف
          </label>

          <Input
            {...register("name")}
            placeholder={`اسم الصنف (مثال: ${hints.itemName})`}
            className="border-ink-600 bg-ink-900 text-paper placeholder:text-mist"
          />

          <p className="mt-1 text-sm text-red-500">
            {errors.name?.message}
          </p>

          {duplicateItem && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                يوجد صنف بنفس الاسم "{duplicateItem.name}" بالفعل.{" "}
                <Link
                  href={`/items/edit/${duplicateItem.id}`}
                  className="font-bold text-splash underline"
                >
                  اضغط هنا لتعديله
                </Link>{" "}
                بدل إضافة صنف مكرر.
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm">
            الباركود (اختياري)
          </label>

          {/* الكتابة باليد ممكنة، بس باركود المنتج ١٣ رقم — والكتابة
              اليدوية معناها رقم غلط كل كام صنف، والرقم الغلط
              مابيبانش غير يوم ما الكاشير يمسح ومايلاقيش. الكاميرا
              بتشيل المصدر ده خالص. */}
          <div className="flex gap-2">
            <Input
              {...register("barcode")}
              placeholder="امسحه بالكاميرا أو اكتبه"
              inputMode="numeric"
              className="border-ink-600 bg-ink-900 text-paper placeholder:text-mist"
            />

            <button
              type="button"
              onClick={() => setScanningBarcode(true)}
              aria-label="امسح الباركود بالكاميرا"
              className="flex shrink-0 items-center gap-2 rounded-xl border border-ink-600 bg-ink-900 px-4 text-paper transition hover:bg-ink-700"
            >
              <ScanBarcode size={18} />
              <span className="hidden sm:inline">امسح</span>
            </button>

            {/* للبضاعة اللي المحل بيعبّيها بنفسه ومالهاش ملصق من
                مصنع: كيس مكسرات، علبة بهارات، دراي فود. */}
            <button
              type="button"
              onClick={generateBarcode}
              disabled={generating}
              aria-label="ولّد كود داخلي"
              className="flex shrink-0 items-center gap-2 rounded-xl border border-ink-600 bg-ink-900 px-4 text-paper transition hover:bg-ink-700 disabled:opacity-50"
            >
              <Sparkles size={18} />
              <span className="hidden sm:inline">ولّد</span>
            </button>
          </div>

          <p className="mt-1 text-xs text-mist">
            البضاعة الجاهزة امسح باركودها. اللي بتعبّيه بنفسك، ولّدله
            كود واطبعه من شاشة الملصقات.
          </p>

          {scanningBarcode && (
            <BarcodeScanner
              onScan={(code) => {
                // `shouldDirty` عشان زرار الحفظ يعرف إن فيه تغيير.
                setValue("barcode", code, { shouldDirty: true });
                setScanningBarcode(false);

                return { ok: true, label: code };
              }}
              onClose={() => setScanningBarcode(false)}
            />
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm">
            الفئة (اختياري)
          </label>

          <select
            {...register("category_id")}
            className="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-paper"
          >
            <option value="">بدون فئة</option>

            {categories.map((category) => (
              <option
                key={category.id}
                value={category.id}
              >
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm">
            النوع
          </label>

          <select
            {...register("item_type")}
            className="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-paper"
          >
            <option value="product">منتج</option>
            <option value="service">خدمة</option>
          </select>
        </div>

        {/* ============================================================
            بشتريه جاهز ولا بعمله هنا
            ============================================================

            السؤال ده كان **مش موجود**، والجواب كان مفروض: كل منتج
            بضاعة ليها مخزون.

            وde شغل تمام في سوبر ماركت. في قهوة لأ: كوباية اللاتيه
            مش "بضاعة عندي منها ٤٠"، هي حاجة بتتعمل وقت الطلب من بن
            ولبن وكوب. وأول ما البرنامج طلب من كيرو رقم مخزون
            للمشروب، كتب **١٠٠** لكل واحد من ٤٥ مشروب - مش لأنه
            غلطان، لأن الشاشة سألت سؤال مالوش جواب.

            والرقم ده بينزل مع كل بيعة. يعني كل مشروب عنده كان
            **قنبلة موقوتة** بتضرب لما يوصل صفر فيرفض البيع.

            السؤال هنا بيحل المشكلة من جذرها، وبيفتح الباب للوصفة:
            "بعمله هنا" معناها التكلفة بتيجي من المكوّنات. */}
        {itemType === "product" && !isIngredient && (
          <div className="sm:col-span-2">
            <span className="mb-2 block text-sm">
              الصنف ده بييجي منين؟
            </span>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    value: true,
                    title: "بشتريه جاهز",
                    hint: "زي الكانز والزجاجات والمعلبات: عندك منه كمية بتنقص لما تبيع، والبرنامج بينبّهك لما تقرب تخلص.",
                  },
                  {
                    value: false,
                    title: "بعمله هنا في المحل",
                    hint: "زي كوباية القهوة والعصير والساندوتش: مالوش مخزون بذاته - اللي بينقص هو المكوّنات، وبتحددهم في «الوصفة» تحت.",
                  },
                ] as const
              ).map((choice) => (
                <label
                  key={String(choice.value)}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                    hasStock === choice.value
                      ? "border-splash bg-splash-dim/30"
                      : "border-ink-600 bg-ink-900 hover:border-ink-500"
                  }`}
                >
                  <input
                    type="radio"
                    checked={hasStock === choice.value}
                    onChange={() =>
                      setValue("has_stock", choice.value, { shouldDirty: true })
                    }
                    className="mt-0.5 size-5 shrink-0"
                  />

                  <span>
                    <span className="block text-sm font-semibold text-paper">
                      {choice.title}
                    </span>

                    <span className="mt-1 block text-xs text-mist">
                      {choice.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <p className="mt-1 text-sm text-red-500">
              {errors.has_stock?.message}
            </p>
          </div>
        )}

        {/* مكوّن — مش بيتباع.
            الوصفات خلقت نوع جديد من الأصناف: البن والسكر والكوب
            بيتضافوا عشان الوصفة تخصم منهم، ومحدش بيبيعهم بالحبة.
            من غير العلامة دي كانوا هيظهروا للكاشير جنب القهوة. */}
        {itemType === "product" && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-600 bg-ink-900 p-4 sm:col-span-2">
            <input
              type="checkbox"
              {...register("is_ingredient")}
              className="mt-0.5 size-5 shrink-0"
            />

            <span>
              <span className="block text-sm font-semibold text-paper">
                ده مكوّن — مش بيتباع لوحده
              </span>

              <span className="mt-1 block text-xs text-mist">
                زي البن والسكر والأكواب: بيتخصموا لما تبيع حاجة معمولة
                منهم، بس <strong>مايظهروش في شاشة الكاشير</strong> عشان
                محدش يبيعهم بالغلط. لسه هيبانوا في المخزون والمشتريات
                والتقارير عادي.
              </span>
            </span>
          </label>
        )}

        <div>
          <label className="mb-2 block text-sm">
            طريقة البيع
          </label>

          <select
            {...register("sale_method")}
            className="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-paper"
          >
            {itemType === "service" ? (
              <option value="piece">لكل مرة</option>
            ) : (
              <>
                <option value="piece">بالقطعة</option>
                <option value="weight">بالوزن</option>
                <option value="money">بالسعر المباشر</option>
              </>
            )}
          </select>
        </div>

        {itemType === "product" && (
          <div>
            <label className="mb-2 block text-sm">
              الوحدة
            </label>

            <Input
              {...register("unit")}
              placeholder={`مثال: ${hints.unit}`}
              className="border-ink-600 bg-ink-900 text-paper placeholder:text-mist"
            />

            <p className="mt-1 text-sm text-red-500">
              {errors.unit?.message}
            </p>
          </div>
        )}

        {/* الصنف اللي بيتعمل هنا تكلفته بتتحسب من وصفته، فخانة
            "سعر الشراء" مالهاش معنى - وde كان بابًا تاني للرقم
            التخميني: كيرو كتب ٥ و١٠ و٣٠ و١٠٠ لمشروباته، وكل تقرير
            ربح عنده مبني على الأرقام دي. */}
        {itemType === "product" && hasStock && (
          <div>
            <label className="mb-2 block text-sm">
              سعر الشراء
            </label>

            {item ? (
              /* صنف موجود: التكلفة بتتحسب من دفعات المخزون، فالرقم
                 بيتعرض ومابيتكتبش. حقل قابل للكتابة هنا كان بيكدب -
                 القاعدة بترفض اللي بيتبعت منه (ميجريشن 072). */
              <>
                <div className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-paper">
                  {realCost === undefined ? "—" : `${realCost.toFixed(2)} ج`}
                </div>

                <p className="mt-1 text-xs text-mist">
                  بيتحسب لوحده من المشتريات. عشان تغيّره، سجّل عملية شرا.
                </p>
              </>
            ) : (
              <>
                <Input
                  type="number"
                  step="0.01"
                  {...register("buy_price")}
                  className="border-ink-600 bg-ink-900 text-paper placeholder:text-mist"
                />

                <p className="mt-1 text-sm text-red-500">
                  {errors.buy_price?.message}
                </p>
              </>
            )}
          </div>
        )}

        {/* المكوّن مالوش سعر بيع - مابيتباعش. إخفاء الحقل أوضح من
            تركه فاضي: حقل ظاهر ومطلوب بيخلّي صاحب المحل يكتب رقم
            عشوائي عشان يعدّي الشاشة، والرقم ده هيبان في تقرير
            يومًا ما. */}
        {!isIngredient && (
          <div>
            {/* لما المحل مفعّل التسعيرات، الخانة دي **هي** التسعيرة
                الأولى - فلازم تتسمّى باسمها.

                من غير كده كيرو كان بيشوف: «سعر البيع» و«سعر نوبي»
                و«سعر مصري»، ويسأل «طب سعر السياح راح فين؟» - وهو
                قدامه، بس باسم تاني. الاسم الغلط بيخفي الحقل بنفس
                كفاءة ما لو كان مش موجود. */}
            <label className="mb-2 block text-sm">
              {tiersEnabled ? `سعر ${tierLabel(tierLabels, 1)}` : "سعر البيع"}
            </label>

            <Input
              type="number"
              step="0.01"
              {...register("sell_price")}
              className="border-ink-600 bg-ink-900 text-paper placeholder:text-mist"
            />

            <p className="mt-1 text-sm text-red-500">
              {errors.sell_price?.message}
            </p>
          </div>
        )}

        {/* ============================================================
            التسعيرة التانية والتالتة
            ============================================================

            الخانتين دول كانوا موجودين وضاعوا وقت ما النموذج
            اتقسّم لملفات. كيرو عنده ٨٨ صنف بسعرين إضافيين اتحطّوا
            بالاستيراد، وشاشة البيع بتوري الأزرار التلاتة - بس مافيش
            مكان يعدّل منه سعر واحد. اشتكى بإن «التلات تسعيرات
            اختفوا» وكان محق.

            الأسماء بتيجي من المحل نفسه (سياح / نوبي / مصري عند
            كيرو)، مش "تسعيرة ٢" و"تسعيرة ٣" - صاحب المحل بيفكّر
            بأسماء زباينه. */}
        {!isIngredient && tiersEnabled && (
          <>
            {([2, 3] as const).map((tier) => (
              <div key={tier}>
                <label className="mb-2 block text-sm">
                  سعر {tierLabel(tierLabels, tier)}
                </label>

                <Input
                  type="number"
                  step="0.01"
                  placeholder="سيبها فاضية = نفس السعر العادي"
                  {...register(tier === 2 ? "sell_price_2" : "sell_price_3")}
                  className="border-ink-600 bg-ink-900 text-paper placeholder:text-mist"
                />

                <p className="mt-1 text-sm text-red-500">
                  {tier === 2
                    ? errors.sell_price_2?.message
                    : errors.sell_price_3?.message}
                </p>
              </div>
            ))}
          </>
        )}

        {/* الصنف اللي بيتعمل في المحل مالوش مخزون بذاته، فخانة
            "المخزون الحالي" مالهاش جواب صحيح - وحقل ظاهر ومطلوب
            بيخلّي صاحب المحل يكتب رقم عشوائي عشان يعدّي الشاشة.
            كيرو كتب ١٠٠. */}
        {itemType === "product" && !hasStock && (
          <div className="rounded-xl border border-splash/40 bg-ink-900 p-4 sm:col-span-2">
            <p className="text-sm font-semibold text-paper">
              مافيش مخزون للصنف ده — وde صح
            </p>

            <p className="mt-1 text-xs text-mist">
              اللي بينقص هو المكوّنات. احفظ الصنف، وبعدها افتح
              <strong className="text-paper"> «🍳 الوصفة» </strong>
              تحت وحدّد بياخد كام من كل خامة - والبرنامج هيخصمهم
              لوحده مع كل بيعة، ويحسب تكلفة الوحدة وربحها الحقيقي.
            </p>
          </div>
        )}

        {itemType === "product" && hasStock && (
          <>
            <div>
              <label className="mb-2 block text-sm">
                المخزون الحالي
              </label>

              <Input
                type="number"
                step="0.01"
                {...register("stock")}
                className="border-ink-600 bg-ink-900 text-paper placeholder:text-mist"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm">
                الحد الأدنى للتنبيه
              </label>

              <Input
                type="number"
                step="0.01"
                {...register("minimum_stock")}
                className="border-ink-600 bg-ink-900 text-paper placeholder:text-mist"
              />
            </div>

            {warehouseStocks.length > 0 && (
              <div className="rounded-lg border border-ink-600 bg-ink-900 p-4 md:col-span-2">
                <p className="mb-2 text-sm font-semibold text-mist">
                  المخزون حسب المخزن
                </p>

                <div className="space-y-1 text-sm">
                  {warehouseStocks.map((w) => (
                    <div
                      key={w.warehouse_id}
                      className="flex justify-between text-mist"
                    >
                      <span>{w.warehouse_name}</span>
                      <span className="font-semibold text-paper">
                        {w.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      <Button
        type="submit"
        disabled={isSubmitting || (!item && !user)}
        className="gap-2 bg-splash text-ink-950 hover:bg-splash-deep"
      >
        {isSubmitting ? (
          "جار الحفظ..."
        ) : (
          <>
            <Save size={18} />
            {item ? "حفظ التعديلات" : "حفظ الصنف"}
          </>
        )}
      </Button>
    </form>
  );
}
