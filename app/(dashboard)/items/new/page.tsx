import { Package } from "lucide-react";

import ItemForm from "@/components/items/form/ItemForm";

export default function NewItemPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Package size={28} />
          إضافة صنف جديد
        </h1>

        <p className="mt-2 text-mist">
          أضف منتجًا أو خدمة جديدة إلى النظام.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-8">
        <ItemForm />
      </div>
    </main>
  );
}