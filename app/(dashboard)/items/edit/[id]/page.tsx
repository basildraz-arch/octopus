"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";

import ItemForm from "@/components/items/form/ItemForm";
import RecipeEditor from "@/components/items/RecipeEditor";
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
      <main className="p-8 text-center text-mist">
        جارِ التحميل...
      </main>
    );
  }

  if (!item) {
    return (
      <main className="p-8 text-center text-mist">
        الصنف غير موجود.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Pencil size={28} />
          تعديل الصنف
        </h1>

        <p className="mt-2 text-mist">
          {item.name}
        </p>
      </div>

      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-8">
        <ItemForm item={item} />
      </div>

      {/* برّه النموذج عن قصد: نموذج جوه نموذج HTML غلط. والوصفة
          بتتحفظ فورًا مش مع حفظ الصنف. */}
      <RecipeEditor item={item} businessId={item.business_id} />
    </main>
  );
}
