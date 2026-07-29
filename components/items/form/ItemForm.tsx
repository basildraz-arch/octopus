"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createProduct } from "@/repositories/item.repository";

import { itemSchema, ItemSchema } from "./validation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ItemForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ItemSchema>({
    resolver: zodResolver(itemSchema),

    defaultValues: {
      name: "",
      barcode: "",

      buy_price: 0,
      sell_price: 0,

      stock: 0,
      minimum_stock: 0,

      item_type: "product",

      has_stock: true,

      active: true,
    },
  });

  async function onSubmit(values: ItemSchema) {
    try {
      await createProduct({
        ...values,

        keywords: [],

        business_id: undefined,
        category_id: undefined,

        unit: undefined,
        image: undefined,

        sell_by_money: false,
        sell_by_weight: false,
      });

      router.push("/products");
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
          <label>اسم الصنف</label>

          <Input
            {...register("name")}
            placeholder="اسم الصنف"
          />

          <p className="mt-1 text-sm text-red-500">
            {errors.name?.message}
          </p>
        </div>

        <div>
          <label>الباركود</label>

          <Input
            {...register("barcode")}
            placeholder="الباركود"
          />
        </div>

        <div>
          <label>سعر الشراء</label>

          <Input
            type="number"
            {...register("buy_price")}
          />

          <p className="mt-1 text-sm text-red-500">
            {errors.buy_price?.message}
          </p>
        </div>

        <div>
          <label>سعر البيع</label>

          <Input
            type="number"
            {...register("sell_price")}
          />

          <p className="mt-1 text-sm text-red-500">
            {errors.sell_price?.message}
          </p>
        </div>

        <div>
          <label>المخزون</label>

          <Input
            type="number"
            {...register("stock")}
          />
        </div>

        <div>
          <label>الحد الأدنى</label>

          <Input
            type="number"
            {...register("minimum_stock")}
          />
        </div>

      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "جار الحفظ..." : "💾 حفظ الصنف"}
      </Button>
    </form>
  );
}