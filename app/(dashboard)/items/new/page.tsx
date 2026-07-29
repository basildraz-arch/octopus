import ItemForm from "@/components/items/form/ItemForm";

export default function NewItemPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          📦 إضافة صنف جديد
        </h1>

        <p className="mt-2 text-zinc-400">
          أضف منتجًا أو خدمة جديدة إلى النظام.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <ItemForm />
      </div>
    </main>
  );
}