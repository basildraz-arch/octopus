"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Wallet,
  CheckCircle2,
  History,
  AlertTriangle,
} from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";
import {
  getCustomerBalances,
  getCustomerLedger,
  createCustomer,
  recordPayment,
  type CustomerLedgerEntry,
} from "@/repositories/customer.repository";
import { getOpenShift } from "@/repositories/shift.repository";
import type { CustomerBalance } from "@/types/customer";
import type { SettlementMethod } from "@/types/sale";

const METHOD_LABELS: Record<SettlementMethod, string> = {
  cash: "كاش",
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CustomersPage() {
  const { user } = useSession();
  const toast = useToast();

  const [rows, setRows] = useState<CustomerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);

  const [payTarget, setPayTarget] = useState<CustomerBalance | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<SettlementMethod>("cash");

  const [ledgerFor, setLedgerFor] = useState<string | null>(null);
  const [ledger, setLedger] = useState<CustomerLedgerEntry[]>([]);

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    if (!user) return;

    setLoading(true);
    setRows(await getCustomerBalances(user.business_id));
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    if (!user || !newName.trim()) return;

    setAdding(true);

    try {
      await createCustomer({
        businessId: user.business_id,
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
      });

      setNewName("");
      setNewPhone("");
      toast.success("اتضاف العميل");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("تعذر إضافة العميل");
    } finally {
      setAdding(false);
    }
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();

    if (!user || !payTarget) return;

    const amount = Number(payAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("اكتب مبلغ صحيح");
      return;
    }

    setBusyId(payTarget.customer.id);

    try {
      // Attached to the open shift so the money shows up in today's
      // drawer count, not the day the drinks were taken.
      const shift = await getOpenShift(user.business_id);

      await recordPayment({
        businessId: user.business_id,
        customerId: payTarget.customer.id,
        shiftId: shift?.id ?? null,
        amount,
        method: payMethod,
        createdBy: user.id,
      });

      toast.success(`اتسجل دفع ${amount.toFixed(2)} ج`);
      setPayTarget(null);
      setPayAmount("");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("تعذر تسجيل الدفع");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleLedger(customerId: string) {
    if (ledgerFor === customerId) {
      setLedgerFor(null);
      return;
    }

    setLedgerFor(customerId);
    setLedger(await getCustomerLedger(customerId));
  }

  const totalOwed = rows.reduce(
    (sum, row) => sum + Math.max(row.balance, 0),
    0
  );

  return (
    <main className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Users size={28} />
          حسابات العملاء
        </h1>

        <p className="mt-1 text-mist">
          اللي بياخدوا على الحساب ويحاسبوا بعدين
        </p>
      </div>

      <div className="rounded-xl border border-amber-800 bg-amber-950/20 p-5 text-center">
        <p className="text-sm text-mist">إجمالي المستحق عند العملاء</p>

        <p className="mt-2 text-3xl font-bold text-amber-400">
          {totalOwed.toFixed(2)} ج
        </p>
      </div>

      {payTarget && (
        <div className="rounded-xl border border-splash bg-splash/10 p-5">
          <h2 className="mb-1 flex items-center gap-2 font-bold text-splash">
            <Wallet size={18} />
            تحصيل من {payTarget.customer.name}
          </h2>

          <p className="mb-4 text-xs text-mist">
            المستحق عليه {payTarget.balance.toFixed(2)} ج
          </p>

          <form onSubmit={handlePay} className="space-y-3">
            <input
              type="number"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder={payTarget.balance.toFixed(2)}
              autoFocus
              className="w-full rounded-xl border border-ink-600 bg-ink-900 p-4 text-center text-2xl text-paper outline-none focus:border-splash"
            />

            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(METHOD_LABELS) as SettlementMethod[]).map(
                (method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPayMethod(method)}
                    className={`rounded-xl p-3 text-sm font-bold transition ${
                      payMethod === method
                        ? "bg-splash text-ink-950"
                        : "bg-ink-700 text-mist hover:bg-ink-600"
                    }`}
                  >
                    {METHOD_LABELS[method]}
                  </button>
                )
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busyId === payTarget.customer.id}
                className="flex-1 rounded-xl bg-splash p-3 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50"
              >
                سجّل الدفع
              </button>

              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className="rounded-xl border border-ink-600 px-5 text-mist hover:text-paper"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <UserPlus size={18} />
          عميل جديد
        </h2>

        <form onSubmit={handleAdd} className="space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم العميل"
            required
            className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-paper outline-none focus:border-splash"
          />

          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="رقم التليفون (اختياري)"
            className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-paper outline-none focus:border-splash"
          />

          <button
            type="submit"
            disabled={adding}
            className="w-full rounded-xl bg-splash p-3 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50"
          >
            {adding ? "جارِ الإضافة..." : "إضافة"}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="p-8 text-center text-mist">جارِ التحميل...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
          لسه مفيش عملاء على الحساب
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.customer.id}
              className={`rounded-xl border p-4 ${
                row.balance > 0
                  ? "border-amber-800 bg-amber-950/10"
                  : "border-ink-600 bg-ink-800"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-paper">
                    {row.customer.name}
                  </span>

                  {row.customer.phone && (
                    <span className="ms-2 text-xs text-mist">
                      {row.customer.phone}
                    </span>
                  )}
                </div>

                <span
                  className={`text-lg font-bold ${
                    row.balance > 0 ? "text-amber-400" : "text-green-400"
                  }`}
                >
                  {row.balance.toFixed(2)} ج
                </span>
              </div>

              <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-mist">
                <span>أخد {row.charged.toFixed(2)} ج</span>
                <span>دفع {row.paid.toFixed(2)} ج</span>
                {row.lastActivityAt && (
                  <span>آخر حركة {formatDateTime(row.lastActivityAt)}</span>
                )}
              </div>

              {row.balance < 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
                  <AlertTriangle size={12} />
                  دفع أكتر من اللي عليه - الفرق ده رصيد ليه
                </p>
              )}

              <div className="mt-3 flex gap-2">
                {row.balance > 0 && (
                  <button
                    onClick={() => {
                      setPayTarget(row);
                      setPayAmount(String(row.balance.toFixed(2)));
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-splash px-3 py-2 text-sm font-bold text-ink-950 hover:bg-splash-deep"
                  >
                    <CheckCircle2 size={14} />
                    تحصيل
                  </button>
                )}

                <button
                  onClick={() => toggleLedger(row.customer.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-sm text-mist hover:text-paper"
                >
                  <History size={14} />
                  كشف الحساب
                </button>
              </div>

              {ledgerFor === row.customer.id && (
                <div className="mt-3 space-y-1 border-t border-ink-700 pt-3">
                  {ledger.length === 0 ? (
                    <p className="text-xs text-mist">مفيش حركات</p>
                  ) : (
                    ledger.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex justify-between text-xs"
                      >
                        <span
                          className={
                            entry.kind === "charge"
                              ? "text-amber-400"
                              : "text-green-400"
                          }
                        >
                          {entry.kind === "charge" ? "➕" : "💵"} {entry.label}
                        </span>

                        <span className="text-mist">
                          {entry.amount.toFixed(2)} ج ·{" "}
                          {formatDateTime(entry.createdAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
