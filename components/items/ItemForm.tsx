"use client";

import { useState } from "react";

export type ProductFormValues = {
  name: string;
  barcode: string;
  buy_price: number;
  sell_price: number;
  stock: number;
  minimum_stock: number;
  unit: string;
};

type Props = {
  onSubmit: (values: ProductFormValues) => Promise<void>;
};

export default function ProductForm({ onSubmit }: Props) {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<ProductFormValues>({
    name: "",
    barcode: "",
    buy_price: 0,
    sell_price: 0,
    stock: 0,
    minimum_stock: 0,
    unit: "قطعة",
  });

  function updateField(
    field: keyof ProductFormValues,
    value: string | number
  ) {
    setForm((old) => ({
      ...old,
      [field]: value,
    }));
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);

    await onSubmit(form);

    setLoading(false);

    setForm({
      name: "",
      barcode: "",
      buy_price: 0,
      sell_price: 0,
      stock: 0,
      minimum_stock: 0,
      unit: "قطعة",
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <input
        className="w-full rounded-lg bg-zinc-800 p-3"
        placeholder="اسم المنتج"
        value={form.name}
        onChange={(e) =>
          updateField("name", e.target.value)
        }
      />

      <input
        className="w-full rounded-lg bg-zinc-800 p-3"
        placeholder="الباركود"
        value={form.barcode}
        onChange={(e) =>
          updateField("barcode", e.target.value)
        }
      />

      <input
        className="w-full rounded-lg bg-zinc-800 p-3"
        type="number"
        placeholder="سعر الشراء"
        value={form.buy_price}
        onChange={(e) =>
          updateField("buy_price", Number(e.target.value))
        }
      />

      <input
        className="w-full rounded-lg bg-zinc-800 p-3"
        type="number"
        placeholder="سعر البيع"
        value={form.sell_price}
        onChange={(e) =>
          updateField("sell_price", Number(e.target.value))
        }
      />

      <input
        className="w-full rounded-lg bg-zinc-800 p-3"
        type="number"
        placeholder="الكمية"
        value={form.stock}
        onChange={(e) =>
          updateField("stock", Number(e.target.value))
        }
      />

      <input
        className="w-full rounded-lg bg-zinc-800 p-3"
        type="number"
        placeholder="الحد الأدنى"
        value={form.minimum_stock}
        onChange={(e) =>
          updateField(
            "minimum_stock",
            Number(e.target.value)
          )
        }
      />

      <input
        className="w-full rounded-lg bg-zinc-800 p-3"
        placeholder="الوحدة"
        value={form.unit}
        onChange={(e) =>
          updateField("unit", e.target.value)
        }
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-green-600 py-3 font-bold hover:bg-green-700"
      >
        {loading ? "جارى الحفظ..." : "حفظ المنتج"}
      </button>
    </form>
  );
}