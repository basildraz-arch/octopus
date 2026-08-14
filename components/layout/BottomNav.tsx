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
    title: "سجل",
    href: "/sales-log",
    icon: "📒",
    features: ["pos_sales"],
  },
  {
    title: "إنهاء",
    href: "/day-close",
    icon: "🔒",
    features: ["shifts"],
  },
  {
    title: "تزويد",
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
    title: "تقارير",
    href: "/reports",
    icon: "📊",
    features: ["sales_reports", "warehouse_reports"],
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { hasFeature } = useSession();

  const links = NAV_ITEMS.filter(
    (item) => item.features.length === 0 || item.features.some(hasFeature)
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-600 bg-ink-800 md:hidden">
      {links.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs transition ${
              active ? "text-splash" : "text-mist"
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
