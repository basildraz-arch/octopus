"use client";

import { useEffect, useState } from "react";

import {
  createExpense,
  getExpensesByShift,
  deleteExpense,
  type Expense,
} from "@/repositories/expense.repository";
import { getOpenShift } from "@/repositories/shift.repository";
import { useSession } from "@/hooks/useSession";

export default function ExpensesPage() {
  const { user } = useSession();

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
      alert("حدث خطأ أثناء حفظ المصروف");
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
      alert("تعذر حذف المصروف");
    }
  }

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <main className="min-h-screen bg-gray-950 p-4 text-white md:p-6">
      <h1 className="mb-6 text-3xl font-bold">
        💸 مصروفات اليوم
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 space-y-3 rounded-xl bg-gray-900 p-4"
      >
        <div>
          <label className="mb-1 block text-sm text-gray-400">
            المبلغ
          </label>

          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            required
            className="w-full rounded-xl bg-gray-800 p-3 text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">
            في إيه؟
          </label>

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: أكل غدا، بنزين..."
            required
            className="w-full rounded-xl bg-gray-800 p-3 text-white outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "جارِ الحفظ..." : "💾 حفظ المصروف"}
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
        <div className="p-8 text-center text-gray-400">
          جارِ التحميل...
        </div>
      ) : expenses.length === 0 ? (
        <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-400">
          لا توجد مصروفات النهاردة
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between rounded-xl bg-gray-900 p-4"
            >
              <div>
                <p className="font-semibold">
                  {expense.description}
                </p>

                <p className="text-sm text-gray-400">
                  {expense.amount.toFixed(2)} ج
                </p>
              </div>

              <button
                onClick={() => handleDelete(expense.id)}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm hover:bg-red-700"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
