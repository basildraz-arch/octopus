"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, Wallet } from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { logout } from "@/services/auth.service";
import NotificationBell from "@/components/layout/NotificationBell";
import SuspendedBanner from "@/components/layout/SuspendedBanner";
import { homePathFor, type PermissionKey } from "@/lib/permissions";

const TABS: {
  title: string;
  href: string;
  icon: typeof ShoppingCart;
  permission: PermissionKey;
}[] = [
  { title: "بيع", href: "/sales", icon: ShoppingCart, permission: "sell" },
  {
    title: "مصروف",
    href: "/expenses",
    icon: Wallet,
    permission: "manage_expenses",
  },
];

export default function PosLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hasFeature, can, loading } = useSession();

  const required = TABS.find((tab) => tab.href === pathname)?.permission;
  const blockedByRole = !!user && !!required && !can(required);

  const allowed = !!user && hasFeature("pos_sales") && !blockedByRole;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    // A stock keeper has no till. Send them where they do work.
    if (!hasFeature("pos_sales") || blockedByRole) {
      router.replace(homePathFor(user));
    }
  }, [loading, user, hasFeature, blockedByRole, router]);

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

  const tabs = TABS.filter((tab) => can(tab.permission));

  return (
    <div className="min-h-screen bg-ink-950 text-paper">
      {/* On a 390px phone the shop name, the tabs, the bell and the
          logout button all fighting for one row is what made this look
          cramped. The name is the first thing to go: the person at the
          till knows which shop they are standing in. */}
      <header className="flex items-center justify-between gap-2 border-b border-ink-600 bg-ink-800 px-3 py-2 md:px-4 md:py-3 print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="hidden text-lg font-bold md:block">🐙 Octopus</h1>

          {/* Scrolls rather than pushes: in the screenshot from Basel's
              phone the tabs shoved the bell and the logout button clean
              off the right edge. A row that can overflow must be
              allowed to overflow inside itself. */}
          <nav className="flex gap-1.5 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${
                    pathname === tab.href
                      ? "bg-splash text-ink-950"
                      : "text-mist md:hover:bg-ink-700"
                  }`}
                >
                  <Icon size={16} />
                  {tab.title}
                </Link>
              );
            })}

            {user.role === "owner" && (
              <Link
                href="/dashboard"
                className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-mist transition md:hover:bg-ink-700"
              >
                🏠 <span className="hidden sm:inline">الرئيسية</span>
              </Link>
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

      <SuspendedBanner />

      <main className="p-4">{children}</main>
    </div>
  );
}
