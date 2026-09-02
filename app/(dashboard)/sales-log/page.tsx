"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";

import {
  getSalesByDateRange,
  type SaleWithItems,
} from "@/repositories/sale.repository";
import { useSession } from "@/hooks/useSession";
import VoidSaleButton from "@/components/sales/VoidSaleButton";
import ReturnSaleButton from "@/components/sales/ReturnSaleButton";
import PrintReport from "@/components/reports/PrintReport";
import VoidedAndReturns from "@/components/sales/VoidedAndReturns";

function todayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function SalesLogContent() {
  const { user, business, can } = useSession();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState(
    searchParams.get("from") ?? todayString()
  );
  const [endDate, setEndDate] = useState(
    searchParams.get("to") ?? todayString()
  );
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    loadSales();
  }, [user, startDate, endDate]);

  async function loadSales() {
    if (!user) return;

    setLoading(true);

    const data = await getSalesByDateRange(
      user.business_id,
      startDate,
      endDate
    );

    setSales(data);

    setLoading(false);
  }

  const periodTotal = useMemo(() => {
    return sales.reduce((sum, sale) => sum + sale.total, 0);
  }, [sales]);

  return (
    <main className="space-y-6" data-print-area>
      <PrintReport
        title="سجل المبيعات"
        from={startDate}
        to={endDate}
        businessName={business?.name}
      />

      <div className="print-hide">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <ClipboardList size={28} />
          سجل المبيعات
        </h1>

        <p className="mt-1 text-mist">
          تابع مبيعات محلك أول بأول
        </p>
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <p className="text-sm text-mist">
          إجمالي المبيعات في الفترة المحددة
        </p>

        <h2 className="mt-2 text-4xl font-bold text-green-400">
          {periodTotal.toFixed(2)} ج
        </h2>

        <p className="mt-1 text-sm text-mist">
          {sales.length} عملية بيع
        </p>
      </div>

      <div className="print-hide grid grid-cols-2 gap-3">
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

      {/* الملغي والمرتجع فوق القايمة مش تحتها: الفاتورة اللي
          اتلغت مش موجودة في القايمة تحت أصلًا (الصف اتمسح)، فلو
          السطر ده تحت مية فاتورة محدش هيوصله. */}
      {user && can("view_reports") && (
        <VoidedAndReturns
          businessId={user.business_id}
          from={startDate}
          to={endDate}
        />
      )}

      {loading ? (
        <div className="p-8 text-center text-mist">
          جارِ التحميل...
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
          لا توجد مبيعات في هذه الفترة
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => (
            <details
              key={sale.id}
              className="rounded-xl border border-ink-600 bg-ink-800 p-4"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="min-w-0">
                  {/* الرقم قبل التاريخ: كيرو بيدوّر على "الفاتورة
                      اللي اتسجّلت غلط"، والزبون بيرجع بالرقم اللي
                      على ورقته - مش بالساعة والدقيقة. */}
                  {sale.invoice_number != null && (
                    <span className="block font-bold text-paper">
                      فاتورة {sale.invoice_number}
                    </span>
                  )}

                  <span className="block text-sm text-mist">
                    {new Date(sale.created_at).toLocaleString("ar-EG", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </span>

                <span className="font-bold text-green-400">
                  {sale.total.toFixed(2)} ج
                </span>
              </summary>

              <div className="mt-3 space-y-1 border-t border-ink-600 pt-3">
                {sale.sale_items.map((line) => (
                  <div
                    key={line.id}
                    className="flex justify-between text-sm text-mist"
                  >
                    <span>
                      {line.items?.name ?? "صنف محذوف"} × {line.quantity.toFixed(2)}
                    </span>

                    <span>
                      {line.total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* الإلغاء جوه الفاتورة المفتوحة، مش زرار في السطر.
                  الزرار اللي بيبان جنب كل فاتورة في القايمة بيتدوس
                  بالغلط - وde آخر حاجة تحصل بالغلط. */}
              {/* الإلغاء والمرتجع لصاحب النشاط (أو اللي اداله
                  `refund_sale`) بس.
                  القاعدة بترفضهم على أي حال، بس زرار بيظهر وبيرفض
                  أسوأ من زرار مش موجود: الكاشير بيدوس، بياخد رسالة
                  "ممنوع"، ويفتكر إن البرنامج باظ. */}
              {can("refund_sale") && (
              <div className="print-hide">
                {/* المرتجع فوق الإلغاء عن قصد: المرتجع هو الحالة
                    الشايعة (الزبون رجّع حاجة)، والإلغاء نادر
                    (الفاتورة اتسجّلت غلط أصلًا). */}
                <ReturnSaleButton
                  saleId={sale.id}
                  lines={sale.sale_items}
                  onReturned={loadSales}
                />

                <VoidSaleButton
                  saleId={sale.id}
                  total={sale.total}
                  createdAt={sale.created_at}
                  onVoided={loadSales}
                />
              </div>
              )}
            </details>
          ))}
        </div>
      )}
    </main>
  );
}

export default function SalesLogPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-center text-mist">
          جارِ التحميل...
        </main>
      }
    >
      <SalesLogContent />
    </Suspense>
  );
}
