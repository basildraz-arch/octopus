"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/hooks/useSession";

const links = [
  {
    title: "الرئيسية",
    href: "/dashboard",
    icon: "🏠",
  },
  {
    title: "بيع",
    href: "/sales",
    icon: "🛒",
  },
  {
    title: "الأصناف",
    href: "/items",
    icon: "📦",
  },
  {
    title: "سجل المبيعات",
    href: "/sales-log",
    icon: "📒",
  },
  {
    title: "إنهاء اليوم",
    href: "/day-close",
    icon: "🔒",
  },
  {
    title: "تزويد المخزون",
    href: "/purchases",
    icon: "🚚",
  },
  {
    title: "التقارير",
    href: "/reports",
    icon: "📊",
  },
  {
    title: "الإعدادات",
    href: "/settings",
    icon: "⚙️",
  },

  // غير مبنية بعد - رجّعها لما تتعمل الصفحة دي
  // {
  //   title: "العملاء",
  //   href: "/customers",
  //   icon: "👥",
  // },
];

const ADMIN_EMAIL = "basildraz@gmail.com";

export default function Navigation() {
  const pathname = usePathname();
  const { user } = useSession();

  const visibleLinks =
    user?.email === ADMIN_EMAIL
      ? [...links, { title: "نشاط", href: "/activity", icon: "📈" }]
      : links;

  return (
    <nav className="space-y-2">
      {visibleLinks.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all
              ${
                active
                  ? "bg-blue-600 text-white"
                  : "hover:bg-zinc-800 text-zinc-300"
              }`}
          >
            <span className="text-xl">
              {item.icon}
            </span>

            <span className="font-medium">
              {item.title}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
