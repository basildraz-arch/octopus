"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getItems } from "@/repositories/item.repository";
import { getOpenShift, type Shift } from "@/repositories/shift.repository";
import {
  getReportSummary,
  type ReportSummary,
} from "@/repositories/report.repository";
import {
  getCartAuditByDate,
  summarizeCartSessions,
} from "@/repositories/cartAudit.repository";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { contextFor, labelsFor, visibleTiles } from "@/lib/navItems";
import ShiftAgeWarning from "@/components/ShiftAgeWarning";

import type { Item } from "@/types/item";

function todayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function DashboardHomePage() {
  const { user, business, hasFeature, isPlatformAdmin } = useSession();

  // Same functions the sidebar and the route guard run - the home
  // screen is not allowed to have its own opinion about what exists.
  const ctx = contextFor(user, business, isPlatformAdmin);
  const labels = labelsFor(business);

  const [items, setItems] = useState<Item[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [todayReport, setTodayReport] = useState<ReportSummary | null>(null);
  const [suspiciousToday, setSuspiciousToday] = useState(0);
  const [stockValue, setStockValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !business) return;

    load();
  }, [user, business]);

  async function load() {
    if (!user) return;

    setLoading(true);

    const today = todayString();

    const [itemsData, openShift, report, auditEvents, invValue] =
      await Promise.all([
        getItems(user.business_id),
        getOpenShift(user.business_id),
        getReportSummary(user.business_id, today, today),
        getCartAuditByDate(user.business_id, today),

        // القيمة بتتجمّع جوه القاعدة. الجمع في المتصفح مبقاش ينفع:
        // items.buy_price ممنوع للقراءة (ميجريشن 070) فالمجموع كان
        // بيطلع صفر لكل الناس - حتى صاحب المحل.
        //
        // بننادي الـRPC مباشرة مش getInventoryValue، عشان دي بتحوّل
        // الـnull لصفر (المساعد محتاج رقم). هنا الفرق مهم: null
        // معناها "مش من حقك تشوف القيمة" فبنخفي السطر خالص، وصفر
        // معناها "المخزن فاضي" وde رقم يستاهل يتعرض.
        supabase.rpc("inventory_value"),
      ]);

    setItems(itemsData);
    setShift(openShift);
    setTodayReport(report);
    setStockValue(
      invValue.error || invValue.data == null ? null : Number(invValue.data)
    );

    setSuspiciousToday(
      summarizeCartSessions(auditEvents).filter(
        (s) => !s.completed && s.addedCount > 0
      ).length
    );

    setLoading(false);
  }

  const dailyTiles = visibleTiles(ctx, labels, "daily");
  const managementTiles = visibleTiles(ctx, labels, "management");

  if (loading) {
    return <main className="p-8 text-center text-mist">جارِ التحميل...</main>;
  }

  return (
    <main className="space-y-6">
      {/* اليوم مش متقفل من كام يوم؟ لازم يبان هنا قبل الأرقام - لأن
          الأرقام نفسها بتبقى غلط لما الوردية تفضل مفتوحة أيام. */}
      <ShiftAgeWarning />

      {/* Today, in one glance. Small on purpose - the buttons below
          are what the screen is for. */}
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-mist">مبيعات النهارده</p>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              shift ? "bg-green-600 text-white" : "bg-ink-600 text-mist"
            }`}
          >
            {shift ? "اليوم مفتوح" : "اليوم ما بدأش"}
          </span>
        </div>

        <h2 className="mt-2 text-4xl font-bold text-green-400">
          {(todayReport?.totalSales ?? 0).toFixed(2)} ج
        </h2>

        <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-mist">
          <span>{todayReport?.saleCount ?? 0} فاتورة</span>
          <span>
            {items.length} من {labels.items}
          </span>
          {stockValue !== null && (
            <span>
              {labels.stock} بـ {stockValue.toFixed(0)} ج
            </span>
          )}
        </div>
      </div>

      {/* The one thing done more than anything else gets the biggest
          target on the screen. */}
      {hasFeature("pos_sales") && (
        <Link
          href="/sales"
          className="flex items-center justify-center gap-3 rounded-2xl bg-green-600 p-8 text-3xl font-bold text-white shadow-lg transition hover:bg-green-700"
        >
          <span className="text-4xl">🛒</span>
          {labels.sale}
        </Link>
      )}

      {suspiciousToday > 0 && (
        <Link
          href="/sales-audit"
          className="flex items-center justify-between rounded-2xl border border-red-700 bg-red-950/30 p-5 transition hover:bg-red-950/50"
        >
          <span className="flex items-center gap-3">
            <span className="text-3xl">⚠️</span>

            <span>
              <span className="block font-bold text-red-400">
                {suspiciousToday} فاتورة اتفتحت وماتنفذتش
              </span>

              <span className="block text-xs text-mist">
                دوس تشوف مين وإمتى بالظبط
              </span>
            </span>
          </span>

          <span className="text-2xl text-mist">‹</span>
        </Link>
      )}

      {dailyTiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {dailyTiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-ink-600 bg-ink-800 p-4 text-center transition hover:border-splash hover:bg-ink-700"
            >
              <span className="text-4xl">{tile.icon}</span>

              <span className="text-sm font-bold text-paper">
                {tile.text}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* الإدارة مطويّة افتراضيًا.
          الشاشة دي بتتفتح كل يوم عشان **حاجتين**: تبيع، وتشوف بعت
          بكام. والباقي — الموظفين والإعدادات والمخازن والفئات —
          بيتفتح مرة في الأسبوع أو أقل.
          تمانية مربعات ليهم نفس الوزن البصري بتخلّي المهم يضيع في
          النادر. ونفس القاعدة اللي في الإعدادات (AGENTS.md §٥):
          المجموعات كلها مقفولة افتراضيًا. */}
      {managementTiles.length > 0 && (
        <details className="rounded-2xl border border-ink-600 bg-ink-800/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-paper">
              <span aria-hidden>🗄️</span>
              إدارة المحل
            </span>

            <span className="text-xs text-mist">
              {managementTiles.length} شاشة
            </span>
          </summary>

          <div className="grid grid-cols-3 gap-3 border-t border-ink-600 p-4 sm:grid-cols-4">
            {managementTiles.map((tile) => (
              <Link
                key={tile.href}
                href={tile.href}
                className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-ink-600 bg-ink-800/60 p-3 text-center transition hover:border-splash hover:bg-ink-700"
              >
                <span className="text-2xl">{tile.icon}</span>

                <span className="text-xs font-medium text-mist">
                  {tile.text}
                </span>
              </Link>
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
