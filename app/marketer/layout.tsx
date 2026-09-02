"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Megaphone, Wallet, MonitorPlay, LogOut } from "lucide-react";

import { signOut } from "@/repositories/auth.repository";

// ============================================================
// قشرة شاشة المسوّق
// ============================================================
//
// باسل: "صفحة المسوقين على الموبايل ظاهرة بواجهة الكمبيوتر."
//
// والسبب مش تنسيق: صفحات المسوّق اتحطّت **بره** مجموعات
// `(dashboard)` و`(pos)`، وهما اللي فيهم قشرة التطبيق كلها -
// الترويسة اللاصقة، والشريط السفلي بتاع الموبايل، والقايمة
// الجانبية للكمبيوتر. فالصفحة كانت بتترسم على الـ`<body>` عريان:
// نص صغير، وكروت عريضة، ومفيش أي حاجة تحت تحت الإيد.
//
// وde كان مقصود جزئيًا (المسوّق مالوش صف في `users` فقشرة التطبيق
// كانت هتحاول تقرا جلسة مش موجودة) - بس النتيجة كانت صفحة ويب
// عادية جوه تطبيق موبايل.
//
// القشرة دي مبنية للمسوّق: **إيده على الشاشة وهو واقف في محل**.
// صفحتين بس، فالشريط السفلي فيه اتنين وخلاص، والخروج فوق بعيد عن
// الإبهام عشان مايتدوسش بالغلط.

const TABS = [
  { href: "/marketer", label: "فلوسي", icon: Wallet },
  { href: "/marketer/demo", label: "اعرض", icon: MonitorPlay },
];

export default function MarketerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push("/login/marketer");
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-paper">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-ink-600 bg-ink-800 px-4">
        <span className="flex items-center gap-2 font-bold">
          <Megaphone size={18} className="text-splash" />
          الأخطبوط
          <span className="text-xs font-normal text-mist">للمسوّقين</span>
        </span>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg bg-ink-700 px-3 py-1.5 text-xs text-paper transition hover:bg-ink-600"
        >
          <LogOut size={13} />
          خروج
        </button>
      </header>

      {/* pb-24 على الموبايل عشان الشريط السفلي ما يغطّيش آخر كارت. */}
      <main className="flex-1 pb-24 md:pb-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-600 bg-ink-800 md:hidden">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/marketer"
              ? pathname === "/marketer"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition ${
                active ? "text-splash" : "text-mist"
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
