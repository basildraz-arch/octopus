"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Warehouse as WarehouseIcon,
  ArrowLeftRight,
  Plus,
  Save,
  CheckCircle2,
  Pencil,
  Pause,
  Play,
} from "lucide-react";

import {
  getWarehouses,
  updateWarehouse,
} from "@/repositories/warehouse.repository";
import { createChangeRequest } from "@/repositories/changeRequest.repository";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";
import type { Warehouse } from "@/types/warehouse";

export default function WarehousesPage() {
  const { user } = useSession();
  const toast = useToast();

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
      // Adding a second warehouse reshapes how the shop works, so it
      // goes through approval - the database refuses the insert
      // outright otherwise (migration 049). What used to be a direct
      // insert here is now a request.
      await createChangeRequest({
        businessId: user.business_id,
        requestedBy: user.id,
        kind: "add_warehouse",
        payload: { name: trimmed },
        note: `مخزن جديد: ${trimmed}`,
      });

      setNewName("");
      toast.success("الطلب اتبعت - المخزن هيتعمل بعد الموافقة");
    } catch (err) {
      console.error(err);
      toast.error("تعذر إرسال الطلب");
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
      toast.error("حدث خطأ أثناء حفظ التعديل");
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(warehouse: Warehouse) {
    if (warehouse.is_default && warehouse.active) {
      toast.error("لا يمكن تعطيل المخزن الافتراضي");
      return;
    }

    try {
      await updateWarehouse(warehouse.id, { active: !warehouse.active });
      await loadWarehouses();
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء تحديث حالة المخزن");
    }
  }

  const activeWarehousesCount = warehouses.filter((w) => w.active).length;

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <WarehouseIcon size={28} />
            المخازن
          </h1>

          <p className="mt-1 text-mist">
            إدارة مواقع تخزين المخزون
          </p>
        </div>

        {activeWarehousesCount > 1 && (
          <Link
            href="/warehouses/transfer"
            className="flex items-center justify-center gap-2 rounded-lg bg-ink-700 px-5 py-3 text-center font-semibold transition hover:bg-ink-600 sm:w-auto"
          >
            <ArrowLeftRight size={18} />
            نقل مخزون
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <Plus size={18} />
          اطلب مخزن جديد
        </h2>

        <p className="mb-4 text-xs text-mist">
          المخزن الجديد بيتعمل بعد الموافقة - هيوصلك تنبيه أول ما يتراجع.
        </p>

        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم المخزن (مثال: مخزن الفرع الثاني)"
            className="flex-1 rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
          />

          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-splash px-6 py-3 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50 sm:w-auto"
          >
            {adding ? (
              "جارِ الإرسال..."
            ) : (
              <>
                <Save size={18} />
                ابعت الطلب
              </>
            )}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center">
          جارِ تحميل المخازن...
        </div>
      ) : warehouses.length === 0 ? (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
          لا توجد مخازن بعد.
        </div>
      ) : (
        <div className="space-y-3">
          {warehouses.map((warehouse) => (
            <div
              key={warehouse.id}
              className="rounded-xl border border-ink-600 bg-ink-800 p-4"
            >
              {editingId === warehouse.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
                />
              ) : (
                <div>
                  <h3 className="font-semibold">
                    {warehouse.name}
                  </h3>

                  {(warehouse.is_default || !warehouse.active) && (
                    <div className="mt-1 flex gap-2">
                      {warehouse.is_default && (
                        <span className="rounded bg-splash px-2 py-1 text-xs text-ink-950">
                          افتراضي
                        </span>
                      )}

                      {!warehouse.active && (
                        <span className="rounded bg-ink-600 px-2 py-1 text-xs">
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
                      onClick={() => startEdit(warehouse)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded bg-splash px-3 py-2.5 text-sm text-ink-950 hover:bg-splash-deep"
                    >
                      <Pencil size={14} />
                      تعديل
                    </button>

                    <button
                      onClick={() => toggleActive(warehouse)}
                      disabled={warehouse.is_default && warehouse.active}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2.5 text-sm text-paper transition disabled:opacity-40 ${
                        warehouse.active
                          ? "bg-ink-700 hover:bg-ink-600"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {warehouse.active ? (
                        <>
                          <Pause size={14} />
                          تعطيل
                        </>
                      ) : (
                        <>
                          <Play size={14} />
                          تفعيل
                        </>
                      )}
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
