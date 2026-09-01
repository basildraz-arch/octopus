"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Save } from "lucide-react";

import {
  createItem,
  updateItem,
  adjustItemStock,
  findItemByName,
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

          stock: item.stock,
          minimum_stock: item.minimum_stock,

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

          stock: 0,
          minimum_stock: 0,

          is_ingredient: false,
        },
  });

  const itemType = watch("item_type");
  const isIngredient = watch("is_ingredient");
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

  async function onSubmit(values: ItemSchema) {
    if (!item) {
      const existing = await findItemByName(values.name);

      if (existing) {
        setDuplicateItem(existing);
        return;
      }
    }

    try {
      if (item) {
        // buy_price بيتشال من التعديل عن قصد.
        //
        // تكلفة صنف موجود بتتحسب من دفعات المخزون (نفس قاعدة stock)،
        // والقاعدة بترفض أي رقم جاي من هنا أصلًا بعد ميجريشن 072.
        // بعتُه هنا ماكانش بيعمل غير إنه يوهم إن الحقل شغال.
        const { stock: newStock, buy_price: _cost, ...rest } = values;

        void _cost;

        await updateItem(item.id, {
          ...rest,
          has_stock: values.item_type === "product",
        });

        if (values.item_type === "product" && user) {
          await adjustItemStock(user.business_id, item, newStock);
        }

        if (user) {
          await logActivity(user.id, user.business_id);
        }
      } else {
        if (!user) return;

        await createItem({
          ...values,

          has_stock: values.item_type === "product",
          active: true,

          business_id: user.business_id,
          image: undefined,
          keywords: [],
        });

        await logActivity(user.id, user.business_id);
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

          <Input
            {...register("barcode")}
            placeholder="الباركود"
            className="border-ink-600 bg-ink-900 text-paper placeholder:text-mist"
          />
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

        {itemType === "product" && (
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
            <label className="mb-2 block text-sm">
              سعر البيع
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

        {itemType === "product" && (
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
