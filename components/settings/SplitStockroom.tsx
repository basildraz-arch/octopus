"use client";

import { useEffect, useState } from "react";
import { Warehouse, Check } from "lucide-react";

import {
  getWarehouses,
  createWarehouse,
} from "@/repositories/warehouse.repository";
import { useToast } from "@/hooks/useToast";
import type { Warehouse as WarehouseType } from "@/types/warehouse";

type Props = {
  businessId: string;
};

// "افصل المخزن عن المعروض في المحل" بدوسة واحدة.
//
// ============================================================
// ليه ده موجود والمخازن المتعددة موجودة أصلًا
// ============================================================
//
// كيرو طلب يفصل المخزن عن المعروض. والآلية موجودة من زمان - بس
// عشان يستعملها لازم يفهم إن "المخزن" في البرنامج حاجة اسمها
// warehouse، ويعمل واحد جديد، ويفهم إيه اللي بيتباع منه، وينقل
// البضاعة.
//
// أربع خطوات وكل واحدة فيها كلمة مش من قاموسه. صاحب محل عايز
// حاجة واحدة: **إن الرقم يتقسم**.
//
// ============================================================
// أسماء المخازن
// ============================================================
//
// "المحل" هو الافتراضي - يعني اللي بيتباع منه. و"المخزن" الجديد
// بيتعمل فاضي.
//
// **ما بننقلش أي بضاعة تلقائيًا.** الرصيد الحالي كله موجود في
// المحل، وصاحب المحل هو اللي يعرف كام منه عايزه يروح للمخزن.
// حركة مخزون تلقائية من غير ما حد يطلبها بتخلّي الأرقام تتحرك
// لوحدها - وde آخر حاجة محتاجينها.
export default function SplitStockroom({ businessId }: Props) {
  const toast = useToast();

  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getWarehouses(businessId)
      .then((data) => {
        if (!cancelled) setWarehouses(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  async function run() {
    setBusy(true);

    try {
      const created = await createWarehouse({
        business_id: businessId,
        name: "المخزن",
        is_default: false,
        active: true,
      });

      setWarehouses((current) => [...current, created]);

      toast.success("اتعمل مخزن جديد — انقل له البضاعة اللي مش معروضة");
    } catch (err) {
      // رسالة القاعدة عربية وموجّهة للمستخدم ("باقتك فيها مخزن
      // واحد..."), فبنعرضها زي ما هي بدل ما نخترع واحدة.
      toast.error(
        err instanceof Error ? err.message : "تعذر إضافة المخزن"
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  const alreadySplit = warehouses.length > 1;

  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-paper">
        <Warehouse size={15} />
        فصل المخزن عن المعروض في المحل
      </h3>

      {alreadySplit ? (
        <p className="flex items-start gap-2 rounded-lg border border-ink-600 bg-ink-900 p-3 text-xs text-mist">
          <Check size={14} className="mt-0.5 shrink-0 text-green-400" />
          <span>
            عندك {warehouses.length} مخازن ({warehouses.map((w) => w.name).join("، ")}).
            كمية كل صنف في كل مخزن بتبان في صفحة الصنف.
          </span>
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-mist">
            دلوقتي كل البضاعة في مكان واحد. لو عندك بضاعة في المخزن مش
            معروضة على الرفوف، افصلهم عشان تعرف كام هنا وكام هناك —
            والبيع بيفضل من المحل بس.
          </p>

          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-sm font-semibold text-paper transition hover:border-splash disabled:opacity-50"
          >
            {busy ? "جارِ الإنشاء..." : "اعمل مخزن منفصل"}
          </button>

          <p className="mt-2 text-xs text-mist">
            مابينقلش بضاعة لوحده — بيعمل المخزن فاضي وإنت تنقل له اللي
            إنت عايزه.
          </p>
        </>
      )}
    </div>
  );
}
