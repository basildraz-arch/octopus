"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { getItems } from "@/repositories/item.repository";
import { getSalesByDateRange } from "@/repositories/sale.repository";
import { getCustomerBalances } from "@/repositories/customer.repository";
import { toCsv, downloadCsv, dateStamp } from "@/lib/csv";
import { useToast } from "@/hooks/useToast";
import { resolveLabels } from "@/lib/uiLabels";
import type { Business } from "@/types/business";

// "لو بطّلت أدفع، أقدر أطلّع بياناتي؟"
//
// That question follows every subscription pitch, and until now the
// honest answer was no. A shop's items and its sales history are the
// shop's, not ours, and being able to leave with them is the thing
// that makes staying a choice rather than a trap. It also happens to
// be the answer that closes the objection in the room.
export default function ExportData({
  businessId,
  business,
}: {
  businessId: string;
  business: Business | null;
}) {
  const toast = useToast();

  const [busy, setBusy] = useState<string | null>(null);

  const labels = resolveLabels(business);

  async function run(key: string, work: () => Promise<void>) {
    setBusy(key);

    try {
      await work();
      toast.success("اتحمّل الملف");
    } catch (err) {
      console.error(err);
      toast.error("تعذر التصدير");
    } finally {
      setBusy(null);
    }
  }

  async function exportItems() {
    const items = await getItems();

    const csv = toCsv(
      ["الاسم", "سعر البيع", "سعر 2", "سعر 3", "التكلفة", "الكمية", "الوحدة"],
      items.map((item) => [
        item.name,
        item.sell_price,
        item.sell_price_2 ?? "",
        item.sell_price_3 ?? "",
        item.buy_price,
        item.has_stock ? item.stock : "",
        item.unit,
      ])
    );

    downloadCsv(`octopus-items-${dateStamp()}.csv`, csv);
  }

  async function exportSales() {
    // A year back covers every shop we have. Someone with more
    // history than that gets it in one file too - the range is the
    // window, not a page size.
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);

    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const sales = await getSalesByDateRange(businessId, iso(start), iso(end));

    const rows: unknown[][] = [];

    for (const sale of sales) {
      for (const line of sale.sale_items ?? []) {
        rows.push([
          new Date(sale.created_at).toLocaleString("ar-EG"),
          sale.id,
          line.items?.name ?? "صنف محذوف",
          line.quantity,
          line.unit_price,
          line.total,
          sale.total,
        ]);
      }
    }

    const csv = toCsv(
      ["التاريخ", "رقم الفاتورة", "الصنف", "الكمية", "سعر الوحدة", "إجمالي السطر", "إجمالي الفاتورة"],
      rows
    );

    downloadCsv(`octopus-sales-${dateStamp()}.csv`, csv);
  }

  async function exportCustomers() {
    const customers = await getCustomerBalances(businessId);

    const csv = toCsv(
      ["الاسم", "التليفون", "الرصيد"],
      customers.map((entry) => [
        entry.customer.name,
        entry.customer.phone ?? "",
        entry.balance,
      ])
    );

    downloadCsv(`octopus-customers-${dateStamp()}.csv`, csv);
  }

  const buttons = [
    { key: "items", label: labels.items, run: exportItems },
    { key: "sales", label: "المبيعات (سنة)", run: exportSales },
    { key: "customers", label: labels.customers, run: exportCustomers },
  ];

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <Download size={18} />
        تصدير بياناتك
      </h2>

      <p className="mb-4 text-sm text-mist">
        بياناتك بتاعتك. نزّلها وقت ما تحب كملف يفتح في إكسل — من غير ما
        تسأل حد ومن غير ما تستنى.
      </p>

      <div className="flex flex-wrap gap-2">
        {buttons.map((button) => (
          <button
            key={button.key}
            onClick={() => run(button.key, button.run)}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-sm font-semibold text-paper transition hover:border-splash disabled:opacity-50"
          >
            <Download size={15} />
            {busy === button.key ? "جارِ التجهيز..." : button.label}
          </button>
        ))}
      </div>
    </div>
  );
}
