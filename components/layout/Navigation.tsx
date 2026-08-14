"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/hooks/useSession";
import type { FeatureKey } from "@/types/business";

type NavItem = {
  title: string;
  href: string;
  icon: string;
  features: FeatureKey[];
};

const NAV_ITEMS: NavItem[] = [
  {
    title: "الرئيسية",
    href: "/dashboard",
    icon: "🏠",
    features: [],
  },
  {
    title: "بيع",
    href: "/sales",
    icon: "🛒",
    features: ["pos_sales"],
  },
  {
    title: "الأصناف",
    href: "/items",
    icon: "📦",
    features: ["inventory"],
  },
  {
    title: "سجل المبيعات",
    href: "/sales-log",
    icon: "📒",
    features: ["pos_sales"],
  },
  {
    title: "إنهاء اليوم",
    href: "/day-close",
    icon: "🔒",
    features: ["shifts"],
  },
  {
    title: "تزويد المخزون",
    href: "/purchases",
    icon: "🚚",
    features: ["inventory"],
  },
  {
    title: "المخازن",
    href: "/warehouses",
    icon: "🏭",
    features: ["multi_warehouse"],
  },
  {
    title: "التقارير",
    href: "/reports",
    icon: "📊",
    features: ["sales_reports", "warehouse_reports"],
  },
  {
    title: "الإعدادات",
    href: "/settings",
    icon: "⚙️",
    features: [],
  },

  // غير مبنية بعد - رجّعها لما تتعمل الصفحة دي
  // {
  //   title: "العملاء",
  //   href: "/customers",
  //   icon: "👥",
  //   features: [],
  // },
];

const ADMIN_EMAIL = "basildraz@gmail.com";

export default function Navigation() {
  const pathname = usePathname();
  const { user, hasFeature } = useSession();

  const baseLinks = NAV_ITEMS.filter(
    (item) => item.features.length === 0 || item.features.some(hasFeature)
  );

  const visibleLinks =
    user?.email === ADMIN_EMAIL
      ? [...baseLinks, { title: "نشاط", href: "/activity", icon: "📈", features: [] }]
      : baseLinks;

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
                  ? "bg-splash text-ink-950"
                  : "hover:bg-ink-700 text-mist"
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
