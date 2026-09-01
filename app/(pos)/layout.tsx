"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, X } from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { logout } from "@/services/auth.service";
import NotificationBell from "@/components/layout/NotificationBell";
import SuspendedBanner from "@/components/layout/SuspendedBanner";
import { homePathFor } from "@/lib/permissions";
import {
  contextFor,
  labelsFor,
  canOpen,
  visibleNavItems,
  visiblePosTiles,
} from "@/lib/navItems";

// ============================================================
// الشاشة دي كانت بتحتفظ بقايمة خاصة بيها — وde كان bug
// ============================================================
//
// كانت فيها مصفوفة متكتوبة بالإيد:
//
//     TABS = [ بيع، مصروف ]
//
// وخلاص. يعني صاحب المحل يقدر يدّي الكاشير صلاحية "يستلم بضاعة" أو
// "يقفل اليوم"، والقاعدة تسمحله فعلًا، والـ`ROUTE_RULES` تسمحله —
// **ومايلاقيش أي رابط يوصله**. معاه المفتاح ومفيش باب.
//
// وde حصل عند كيرو بالظبط: عمار وعبدو الاتنين معاهم
// `["close_day", "receive_stock"]` ومش شايفين ولا شاشة منهم.
//
// `AGENTS.md` §٥ بيقول إن `lib/navItems.ts` هو **المصدر الوحيد**
// لأي قايمة. الشاشة دي كانت المكان الوحيد اللي مابيقراش منه، وde
// السبب المباشر.
//
// دلوقتي بتقرا من نفس المصدر: أي صلاحية جديدة تتدي لموظف بتفتحله
// شاشتها تلقائيًا، النهاردة وفي المستقبل.
//
// ============================================================
// ليه "المزيد" مش تبويبات كلها
// ============================================================
//
// الكاشير معاه كل الصلاحيات ممكن يوصل ٩ شاشات. تسعة تبويبات في
// شريط موبايل عرضه ٣٩٠ بكسل = حاجة مالهاش أي معنى.
//
// فالشريط فيه **اللي بيتدوس كل شوية** (بيع ومصروف)، والباقي جوه
// زرار واحد. ومربعات كبيرة لأن دي بتتفتح بإصبع بين زبونين.

export default function PosLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, business, isPlatformAdmin, hasFeature, loading } = useSession();

  const [moreOpen, setMoreOpen] = useState(false);

  const ctx = contextFor(user, business, isPlatformAdmin);
  const labels = labelsFor(business);

  // الحارس بقى `canOpen` بدل جدول محلي - نفس الدالة اللي شاشات
  // الداشبورد بتستعملها، فالإجابة على "الكاشير يقدر يفتح إيه"
  // واحدة في البرنامج كله.
  const blockedByRole = !!user && !canOpen(pathname, ctx);
  const allowed = !!user && hasFeature("pos_sales") && !blockedByRole;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!hasFeature("pos_sales") || blockedByRole) {
      router.replace(homePathFor(user));
    }
  }, [loading, user, hasFeature, blockedByRole, router]);

  // بيقفل الصفحة الجانبية لما الكاشير يروح لشاشة تانية.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 text-paper">
        جارِ التحميل...
      </div>
    );
  }

  // اللي بيتدوس كل شوية: البيع والمصروف. دول بس اللي في الشريط.
  const quick = visibleNavItems(ctx, labels).filter(
    (item) => item.id === "sell" || item.id === "expenses"
  );

  // شاشات الكاشير - `POS_TILES` مش مربعات صاحب المحل.
  //
  // أول محاولة كانت بتعيد استعمال مربعات الرئيسية مفلترة بالصلاحيات،
  // وde كان بيوري الكاشير شاشات مبنية لصاحب المحل. الفلترة بالصلاحية
  // مش كفاية: "سجل المبيعات" بيتفتح بصلاحية `sell` اللي كل كاشير
  // معاه.
  const quickHrefs = new Set(quick.map((item) => item.href));

  const more = visiblePosTiles(ctx, labels).filter(
    (tile) => !quickHrefs.has(tile.href)
  );

  return (
    <div className="min-h-screen bg-ink-950 text-paper">
      <header className="flex items-center justify-between gap-2 border-b border-ink-600 bg-ink-800 px-3 py-2 md:px-4 md:py-3 print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="hidden text-lg font-bold md:block">🐙 Octopus</h1>

          <nav className="flex gap-1.5 overflow-x-auto">
            {quick.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${
                  pathname === item.href
                    ? "bg-splash text-ink-950"
                    : "text-mist md:hover:bg-ink-700"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.text}
              </Link>
            ))}

            {more.length > 0 && (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-mist transition md:hover:bg-ink-700"
              >
                <LayoutGrid size={16} />
                المزيد
              </button>
            )}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />

          <button
            onClick={handleLogout}
            className="min-h-10 rounded-lg bg-ink-700 px-3 text-sm transition md:hover:bg-ink-600"
          >
            خروج
          </button>
        </div>
      </header>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 sm:items-center sm:justify-center sm:p-4"
          onClick={() => setMoreOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl border border-ink-600 bg-ink-800 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl sm:pb-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">اللي تقدر تفتحه</h2>

              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="إغلاق"
                className="flex size-10 items-center justify-center rounded-lg bg-ink-700 text-paper"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {more.map((tile) => (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-ink-600 bg-ink-900 p-4 text-center transition active:bg-ink-700 md:hover:border-splash"
                >
                  <span className="text-3xl" aria-hidden>
                    {tile.icon}
                  </span>

                  <span className="text-sm font-semibold text-paper">
                    {tile.text}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <SuspendedBanner />

      <main className="p-4">{children}</main>
    </div>
  );
}
