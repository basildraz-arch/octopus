"use client";

import { useEffect, useState } from "react";

import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
} from "@/repositories/category.repository";
import { useSession } from "@/hooks/useSession";

export default function CategoriesPage() {
  const { user } = useSession();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);

    const data = await getCategories();

    setCategories(data);

    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    const trimmed = newName.trim();

    if (!trimmed) return;

    setAdding(true);

    try {
      await createCategory({
        business_id: user.business_id,
        name: trimmed,
        active: true,
      });

      setNewName("");
      await loadCategories();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إضافة الفئة");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(id: string) {
    const trimmed = editName.trim();

    if (!trimmed) return;

    setSavingEdit(true);

    try {
      await updateCategory(id, { name: trimmed });

      setEditingId(null);
      setEditName("");
      await loadCategories();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ التعديل");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(category: Category) {
    const confirmed = confirm(
      `تأكيد حذف فئة "${category.name}"؟ الأصناف المرتبطة بيها هتبقى بدون فئة.`
    );

    if (!confirmed) return;

    try {
      await deleteCategory(category.id);
      await loadCategories();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حذف الفئة");
    }
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          🏷️ الفئات
        </h1>

        <p className="mt-1 text-zinc-400">
          تصنيف الأصناف لتسهيل البيع والتنظيم
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-bold">
          ➕ إضافة فئة جديدة
        </h2>

        <form
          onSubmit={handleAdd}
          className="flex gap-3"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم الفئة (مثال: ألبان)"
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
          />

          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="rounded-xl bg-blue-600 px-6 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? "جارِ الإضافة..." : "💾 إضافة"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {loading ? (
          <div className="p-8 text-center">
            جارِ تحميل الفئات...
          </div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-zinc-400">
            لا توجد فئات بعد.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                {editingId === category.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-white outline-none"
                  />
                ) : (
                  <span className="font-semibold">
                    {category.name}
                  </span>
                )}

                <div className="flex shrink-0 gap-2">
                  {editingId === category.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(category.id)}
                        disabled={savingEdit || !editName.trim()}
                        className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        ✅ حفظ
                      </button>

                      <button
                        onClick={cancelEdit}
                        className="rounded bg-zinc-700 px-3 py-1 text-sm text-white hover:bg-zinc-600"
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(category)}
                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                      >
                        ✏️ تعديل
                      </button>

                      <button
                        onClick={() => handleDelete(category)}
                        className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                      >
                        🗑️ حذف
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
