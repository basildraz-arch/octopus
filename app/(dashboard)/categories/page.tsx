"use client";

import { useEffect, useState } from "react";
import { Tag, Plus, Save, CheckCircle2, Pencil, Trash2 } from "lucide-react";

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
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Tag size={28} />
          الفئات
        </h1>

        <p className="mt-1 text-mist">
          تصنيف الأصناف لتسهيل البيع والتنظيم
        </p>
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Plus size={18} />
          إضافة فئة جديدة
        </h2>

        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم الفئة (مثال: ألبان)"
            className="flex-1 rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
          />

          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-splash px-6 py-3 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50 sm:w-auto"
          >
            {adding ? (
              "جارِ الإضافة..."
            ) : (
              <>
                <Save size={18} />
                إضافة
              </>
            )}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center">
          جارِ تحميل الفئات...
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
          لا توجد فئات بعد.
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="rounded-xl border border-ink-600 bg-ink-800 p-4"
            >
              {editingId === category.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
                />
              ) : (
                <h3 className="font-semibold">
                  {category.name}
                </h3>
              )}

              <div className="mt-4 flex gap-2">
                {editingId === category.id ? (
                  <>
                    <button
                      onClick={() => saveEdit(category.id)}
                      disabled={savingEdit || !editName.trim()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded bg-green-600 px-3 py-2.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={15} />
                      حفظ
                    </button>

                    <button
                      onClick={cancelEdit}
                      className="flex-1 rounded bg-ink-700 px-3 py-2.5 text-sm text-paper hover:bg-ink-600"
                    >
                      إلغاء
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(category)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded bg-splash px-3 py-2.5 text-sm text-ink-950 hover:bg-splash-deep"
                    >
                      <Pencil size={14} />
                      تعديل
                    </button>

                    <button
                      onClick={() => handleDelete(category)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded bg-red-600 px-3 py-2.5 text-sm text-white hover:bg-red-700"
                    >
                      <Trash2 size={14} />
                      حذف
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
