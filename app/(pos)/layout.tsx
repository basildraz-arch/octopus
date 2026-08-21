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
      <header className="flex items-center justify-between border-b border-ink-600 bg-ink-800 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">🐙 Octopus</h1>

          <nav className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    pathname === tab.href
                      ? "bg-splash text-ink-950"
                      : "text-mist hover:bg-ink-700"
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
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-mist transition hover:bg-ink-700"
              >
                🏠 الرئيسية
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />

          <button
            onClick={handleLogout}
            className="rounded-lg bg-ink-700 px-3 py-2 text-sm transition hover:bg-ink-600"
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
