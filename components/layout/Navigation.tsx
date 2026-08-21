"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/hooks/useSession";
import { contextFor, labelsFor, visibleNavItems } from "@/lib/navItems";

// No groups, no headers. The list is short, and what appears in it
// depends on who is signed in: a cashier has no "الأصناف", a stock
// keeper has no "بيع".
export default function Navigation() {
  const pathname = usePathname();
  const { user, business, isPlatformAdmin } = useSession();

  const links = visibleNavItems(
    contextFor(user, business, isPlatformAdmin),
    labelsFor(business)
  );

  return (
    <nav className="space-y-2">
      {links.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-lg transition-all
              ${
                active
                  ? "bg-splash text-ink-950"
                  : "hover:bg-ink-700 text-mist"
              }`}
          >
            <span className="text-2xl">{item.icon}</span>

            <span className="font-medium">{item.text}</span>
          </Link>
        );
      })}
    </nav>
  );
}
