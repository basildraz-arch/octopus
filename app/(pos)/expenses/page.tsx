"use client";

import { useEffect, useState } from "react";
import { Wallet, Save, Trash2 } from "lucide-react";

import {
  createExpense,
  getExpensesByShift,
  deleteExpense,
  type Expense,
} from "@/repositories/expense.repository";
import { getOpenShift } from "@/repositories/shift.repository";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";

export default function ExpensesPage() {
  const { user } = useSession();
  const toast = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    load();
  }, [user]);

  async function load() {
    if (!user) return;

    setLoading(true);

    const shift = await getOpenShift(user.business_id);

    if (shift) {
      const data = await getExpensesByShift(shift.id);
      setExpenses(data);
    } else {
      setExpenses([]);
    }

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    const amountValue = Number(amount);

    if (!amountValue || amountValue <= 0 || !description.trim()) return;

    setSaving(true);

    try {
      await createExpense(
        user.business_id,
        user.id,
        amountValue,
        description.trim()
      );

      setAmount("");
      setDescription("");

      await load();
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء حفظ المصروف");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id);
      await load();
    } catch (err) {
      console.error(err);
      toast.error("تعذر حذف المصروف");
    }
  }

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <main className="min-h-screen bg-ink-950 p-4 text-paper md:p-6">
      <h1 className="mb-6 flex items-center gap-2 text-3xl font-bold">
        <Wallet size={28} />
        مصروفات اليوم
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 space-y-3 rounded-xl border border-ink-600 bg-ink-800 p-4"
      >
        <div>
          <label className="mb-1 block text-sm text-mist">
            المبلغ
          </label>

          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            required
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-mist">
            في إيه؟
          </label>

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: أكل غدا، بنزين..."
            required
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-splash p-3 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50"
        >
          {saving ? (
            "جارِ الحفظ..."
          ) : (
            <>
              <Save size={18} />
              حفظ المصروف
            </>
          )}
        </button>
      </form>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">
          مصروفات اليوم
        </h2>

        <span className="font-bold text-red-400">
          {total.toFixed(2)} ج
        </span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-mist">
          جارِ التحميل...
        </div>
      ) : expenses.length === 0 ? (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
          لا توجد مصروفات النهاردة
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between rounded-xl border border-ink-600 bg-ink-800 p-4"
            >
              <div>
                <p className="font-semibold">
                  {expense.description}
                </p>

                <p className="text-sm text-mist">
                  {expense.amount.toFixed(2)} ج
                </p>
              </div>

              <button
                onClick={() => handleDelete(expense.id)}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm hover:bg-red-700"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
