"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import ItemForm from "@/components/items/form/ItemForm";
import { getItemById } from "@/repositories/item.repository";
import type { Item } from "@/types/item";

export default function EditItemPage() {
  const params = useParams<{ id: string }>();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getItemById(params.id).then((data) => {
      setItem(data);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) {
    return (
      <main className="p-8 text-center">
        جارِ التحميل...
      </main>
    );
  }

  if (!item) {
    return (
      <main className="p-8 text-center">
        الصنف غير موجود.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          ✏️ تعديل الصنف
        </h1>

        <p className="mt-2 text-zinc-400">
          {item.name}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <ItemForm item={item} />
      </div>
    </main>
  );
}
