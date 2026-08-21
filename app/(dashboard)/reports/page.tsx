"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, AlertTriangle, ClipboardList, Users } from "lucide-react";

import {
  getReportSummary,
  getEmployeeReports,
  type ReportSummary,
  type EmployeeReportRow,
} from "@/repositories/report.repository";
import { useSession } from "@/hooks/useSession";
import WarehousePulseDashboard from "@/components/reports/WarehousePulseDashboard";

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sunday..6=Saturday
  const diff = (day + 1) % 7; // days since Saturday

  d.setDate(d.getDate() - diff);

  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

const PRESETS = [
  { label: "هذا الأسبوع", getStart: () => startOfWeek(new Date()) },
  { label: "هذا الشهر", getStart: () => startOfMonth(new Date()) },
  { label: "هذا العام", getStart: () => startOfYear(new Date()) },
];

export default function ReportsPage() {
  const { user, business, hasFeature } = useSession();

  const [startDate, setStartDate] = useState(
    toDateString(startOfMonth(new Date()))
  );
  const [endDate, setEndDate] = useState(toDateString(new Date()));
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [staffRows, setStaffRows] = useState<EmployeeReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isWarehouseManagement = hasFeature("warehouse_reports");

  useEffect(() => {
    if (!user || isWarehouseManagement) return;

    load();
  }, [user, isWarehouseManagement, startDate, endDate]);

  async function load() {
    if (!user) return;

    setLoading(true);

    const [data, perStaff] = await Promise.all([
      getReportSummary(user.business_id, startDate, endDate),
      getEmployeeReports(user.business_id, startDate, endDate),
    ]);

    setSummary(data);
    setStaffRows(perStaff);

    setLoading(false);
  }

  function applyPreset(getStart: () => Date) {
    setStartDate(toDateString(getStart()));
    setEndDate(toDateString(new Date()));
  }

  if (isWarehouseManagement) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <BarChart3 size={28} />
            لوحة نبض المخازن
          </h1>

          <p className="mt-1 text-mist">
            متابعة شبه لحظية لمخازنك ونشاطها
          </p>
        </div>

        <WarehousePulseDashboard />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <BarChart3 size={28} />
          التقارير
        </h1>

        <p className="mt-1 text-mist">
          أداء بيزنسك خلال أي فترة
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset.getStart)}
            className="rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium hover:bg-ink-600"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-mist">
            من
          </label>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-ink-600 bg-ink-800 p-3 text-paper outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-mist">
            إلى
          </label>

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-xl border border-ink-600 bg-ink-800 p-3 text-paper outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-mist">
          جارِ التحميل...
        </div>
      ) : summary ? (
        <div className="space-y-3">
          {summary.hasIncompleteCostData && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              تكلفة غير محسوبة لبعض عمليات البيع القديمة في هذه
              الفترة — صافي الربح المعروض ممكن يكون أعلى من الحقيقي.
            </div>
          )}

          <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
            <p className="text-sm text-mist">
              إجمالي المبيعات
            </p>

            <h2 className="mt-2 text-3xl font-bold text-green-400">
              {summary.totalSales.toFixed(2)} ج
            </h2>

            <p className="mt-1 text-sm text-mist">
              {summary.saleCount} عملية بيع
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
              <p className="text-sm text-mist">
                تكلفة البضاعة المباعة
              </p>

              <p className="mt-1 text-xl font-bold text-orange-400">
                {summary.totalCost.toFixed(2)} ج
              </p>
            </div>

            <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
              <p className="text-sm text-mist">
                إجمالي المصروفات
              </p>

              <p className="mt-1 text-xl font-bold text-red-400">
                {summary.totalExpenses.toFixed(2)} ج
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-splash/40 bg-splash-dim p-5">
            <p className="text-sm text-mist">
              صافي الربح
            </p>

            <h2
              className={`mt-2 text-3xl font-bold ${
                summary.netProfit >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {summary.netProfit.toFixed(2)} ج
            </h2>
          </div>

          {staffRows.length > 0 && (
            <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
              <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
                <Users size={18} />
                أداء كل عامل
              </h2>

              <p className="mb-4 text-xs text-mist">
                نفس الفترة المختارة فوق
              </p>

              <div className="space-y-3">
                {staffRows.map((row) => (
                  <div
                    key={row.userId}
                    className="rounded-xl border border-ink-700 bg-ink-900 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-paper">
                        {row.userName}
                      </span>

                      <span className="text-lg font-bold text-green-400">
                        {row.totalSales.toFixed(2)} ج
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-mist sm:grid-cols-4">
                      <span>{row.saleCount} فاتورة</span>
                      <span>متوسط {row.averageSale.toFixed(2)} ج</span>
                      <span>ربح {row.grossProfit.toFixed(2)} ج</span>
                      <span>مصروفات {row.expensesRecorded.toFixed(2)} ج</span>
                    </div>

                    {business?.price_tier_labels &&
                      row.tierCounts.some((c) => c > 0) && (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-mist">
                          {business.price_tier_labels.map((label, index) => (
                            <span key={label}>
                              {label}: {row.tierCounts[index]}
                            </span>
                          ))}
                        </div>
                      )}

                    {row.abandonedCarts > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-red-400">
                        <AlertTriangle size={13} />
                        {row.abandonedCarts} فاتورة اتفتحت وماتنفذتش
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Link
                href="/sales-audit"
                className="mt-4 block text-center text-sm text-mist hover:text-paper"
              >
                تفاصيل الفواتير اللي ماتنفذتش
              </Link>
            </div>
          )}

          <Link
            href={`/sales-log?from=${startDate}&to=${endDate}`}
            className="flex items-center justify-center gap-2 rounded-xl bg-ink-700 p-4 text-center font-semibold text-paper transition hover:bg-ink-600"
          >
            <ClipboardList size={18} />
            عرض التفاصيل
          </Link>
        </div>
      ) : null}
    </main>
  );
}
