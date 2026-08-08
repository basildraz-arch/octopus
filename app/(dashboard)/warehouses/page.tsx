"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
} from "@/repositories/warehouse.repository";
import { useSession } from "@/hooks/useSession";
import type { Warehouse } from "@/types/warehouse";

export default function WarehousesPage() {
  const { user } = useSession();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (user) loadWarehouses();
  }, [user]);

  async function loadWarehouses() {
    if (!user) return;

    setLoading(true);

    const data = await getWarehouses(user.business_id);

    setWarehouses(data);

    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    const trimmed = newName.trim();

    if (!trimmed) return;

    setAdding(true);

    try {
      await createWarehouse({
        business_id: user.business_id,
        name: trimmed,
        is_default: false,
        active: true,
      });

      setNewName("");
      await loadWarehouses();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إضافة المخزن");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(warehouse: Warehouse) {
    setEditingId(warehouse.id);
    setEditName(warehouse.name);
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
      await updateWarehouse(id, { name: trimmed });

      setEditingId(null);
      setEditName("");
      await loadWarehouses();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ التعديل");
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(warehouse: Warehouse) {
    if (warehouse.is_default && warehouse.active) {
      alert("لا يمكن تعطيل المخزن الافتراضي");
      return;
    }

    try {
      await updateWarehouse(warehouse.id, { active: !warehouse.active });
      await loadWarehouses();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء تحديث حالة المخزن");
    }
  }

  const activeWarehousesCount = warehouses.filter((w) => w.active).length;

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            🏭 المخازن
          </h1>

          <p className="mt-1 text-zinc-400">
            إدارة مواقع تخزين المخزون
          </p>
        </div>

        {activeWarehousesCount > 1 && (
          <Link
            href="/warehouses/transfer"
            className="rounded-lg bg-zinc-700 px-5 py-3 text-center font-semibold transition hover:bg-zinc-600 sm:w-auto"
          >
            🔀 نقل مخزون
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-bold">
          ➕ إضافة مخزن جديد
        </h2>

        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم المخزن (مثال: مخزن الفرع الثاني)"
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
          />

          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
          >
            {adding ? "جارِ الإضافة..." : "💾 إضافة"}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          جارِ تحميل المخازن...
        </div>
      ) : warehouses.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          لا توجد مخازن بعد.
        </div>
      ) : (
        <div className="space-y-3">
          {warehouses.map((warehouse) => (
            <div
              key={warehouse.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
            >
              {editingId === warehouse.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
                />
              ) : (
                <div>
                  <h3 className="font-semibold">
                    {warehouse.name}
                  </h3>

                  {(warehouse.is_default || !warehouse.active) && (
                    <div className="mt-1 flex gap-2">
                      {warehouse.is_default && (
                        <span className="rounded bg-blue-600 px-2 py-1 text-xs">
                          افتراضي
                        </span>
                      )}

                      {!warehouse.active && (
                        <span className="rounded bg-zinc-700 px-2 py-1 text-xs">
                          معطّل
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                {editingId === warehouse.id ? (
                  <>
                    <button
                      onClick={() => saveEdit(warehouse.id)}
                      disabled={savingEdit || !editName.trim()}
                      className="flex-1 rounded bg-green-600 px-3 py-2.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      ✅ حفظ
                    </button>

                    <button
                      onClick={cancelEdit}
                      className="flex-1 rounded bg-zinc-700 px-3 py-2.5 text-sm text-white hover:bg-zinc-600"
                    >
                      إلغاء
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(warehouse)}
                      className="flex-1 rounded bg-blue-600 px-3 py-2.5 text-sm text-white hover:bg-blue-700"
                    >
                      ✏️ تعديل
                    </button>

                    <button
                      onClick={() => toggleActive(warehouse)}
                      disabled={warehouse.is_default && warehouse.active}
                      className={`flex-1 rounded px-3 py-2.5 text-sm text-white transition disabled:opacity-40 ${
                        warehouse.active
                          ? "bg-zinc-700 hover:bg-zinc-600"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {warehouse.active ? "⏸ تعطيل" : "▶ تفعيل"}
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
