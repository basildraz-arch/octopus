"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/hooks/useSession";
import { contextFor, labelsFor, visibleNavItems } from "@/lib/navItems";

// Four targets at most, so each one is wide enough to hit with a
// thumb while holding the phone one-handed. Which four depends on the
// person - a stock keeper gets المخازن where a cashier gets بيع.
export default function BottomNav() {
  const pathname = usePathname();
  const { user, business, isPlatformAdmin } = useSession();

  const links = visibleNavItems(
    contextFor(user, business, isPlatformAdmin),
    labelsFor(business)
  ).slice(0, 4);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-600 bg-ink-800 pb-[env(safe-area-inset-bottom)] md:hidden">
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
            <span className="text-2xl">{item.icon}</span>

            <span className="font-medium">{item.text}</span>
          </Link>
        );
      })}
    </nav>
  );
}
