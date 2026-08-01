"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createItem,
  updateItem,
  adjustItemStock,
} from "@/repositories/item.repository";
import { logActivity } from "@/repositories/activity.repository";
import { useSession } from "@/hooks/useSession";

import { itemSchema, ItemSchema } from "./validation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import type { Item } from "@/types/item";

type Props = {
  item?: Item;
};

export default function ItemForm({ item }: Props) {
  const router = useRouter();
  const { user } = useSession();

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

          item_type: item.item_type,
          sale_method: item.sale_method,
          unit: item.unit,

          buy_price: item.buy_price,
          sell_price: item.sell_price,
          min_sell_price: item.min_sell_price,

          stock: item.stock,
          minimum_stock: item.minimum_stock,
        }
      : {
          name: "",
          barcode: "",

          item_type: "product",
          sale_method: "piece",
          unit: "قطعة",

          buy_price: 0,
          sell_price: 0,
          min_sell_price: undefined,

          stock: 0,
          minimum_stock: 0,
        },
  });

  const itemType = watch("item_type");

  useEffect(() => {
    if (itemType === "service") {
      setValue("buy_price", 0);
      setValue("unit", "قطعة");
      setValue("sale_method", "piece");
    }
  }, [itemType, setValue]);

  async function onSubmit(values: ItemSchema) {
    try {
      const minSellPrice =
        values.min_sell_price && values.min_sell_price > 0
          ? values.min_sell_price
          : undefined;

      if (minSellPrice !== undefined && minSellPrice > values.sell_price) {
        alert("الحد الأدنى للسعر لازم يكون أقل من أو يساوي سعر البيع");
        return;
      }

      if (item) {
        const { stock: newStock, ...rest } = values;

        await updateItem(item.id, {
          ...rest,
          min_sell_price: minSellPrice,
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
          min_sell_price: minSellPrice,

          has_stock: values.item_type === "product",
          active: true,

          business_id: user.business_id,
          category_id: undefined,
          image: undefined,
          keywords: [],
        });

        await logActivity(user.id, user.business_id);
      }

      router.push("/items");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحفظ");
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
            placeholder="اسم الصنف"
          />

          <p className="mt-1 text-sm text-red-500">
            {errors.name?.message}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm">
            الباركود (اختياري)
          </label>

          <Input
            {...register("barcode")}
            placeholder="الباركود"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm">
            النوع
          </label>

          <select
            {...register("item_type")}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          >
            <option value="product">📦 منتج</option>
            <option value="service">💈 خدمة</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm">
            طريقة البيع
          </label>

          <select
            {...register("sale_method")}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
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
              placeholder="مثال: قطعة، كيلو، جرام"
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

            <Input
              type="number"
              step="0.01"
              {...register("buy_price")}
            />

            <p className="mt-1 text-sm text-red-500">
              {errors.buy_price?.message}
            </p>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm">
            سعر البيع
          </label>

          <Input
            type="number"
            step="0.01"
            {...register("sell_price")}
          />

          <p className="mt-1 text-sm text-red-500">
            {errors.sell_price?.message}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm">
            الحد الأدنى للسعر (اختياري)
          </label>

          <Input
            type="number"
            step="0.01"
            {...register("min_sell_price")}
            placeholder="اسيبه فاضي لو السعر ثابت"
          />

          <p className="mt-1 text-sm text-red-500">
            {errors.min_sell_price?.message}
          </p>
        </div>

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
              />
            </div>
          </>
        )}

      </div>

      <Button
        type="submit"
        disabled={isSubmitting || (!item && !user)}
      >
        {isSubmitting
          ? "جار الحفظ..."
          : item
          ? "💾 حفظ التعديلات"
          : "💾 حفظ الصنف"}
      </Button>
    </form>
  );
}
