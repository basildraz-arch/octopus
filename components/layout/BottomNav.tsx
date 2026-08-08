"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/hooks/useSession";

const retailLinks = [
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
    title: "سجل",
    href: "/sales-log",
    icon: "📒",
  },
  {
    title: "إنهاء",
    href: "/day-close",
    icon: "🔒",
  },
  {
    title: "تزويد",
    href: "/purchases",
    icon: "🚚",
  },
  {
    title: "تقارير",
    href: "/reports",
    icon: "📊",
  },
];

const warehouseManagementLinks = [
  {
    title: "الرئيسية",
    href: "/dashboard",
    icon: "🏠",
  },
  {
    title: "الأصناف",
    href: "/items",
    icon: "📦",
  },
  {
    title: "المخازن",
    href: "/warehouses",
    icon: "🏭",
  },
  {
    title: "تزويد",
    href: "/purchases",
    icon: "🚚",
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { business } = useSession();

  const links =
    business?.app_mode === "warehouse_management"
      ? warehouseManagementLinks
      : retailLinks;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-zinc-800 bg-zinc-900 md:hidden">
      {links.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs transition ${
              active ? "text-blue-500" : "text-zinc-400"
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
