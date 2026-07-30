"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
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
    title: "سجل",
    href: "/sales-log",
    icon: "📒",
  },
  {
    title: "إنهاء",
    href: "/day-close",
    icon: "🔒",
  },
];

export default function BottomNav() {
  const pathname = usePathname();

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
