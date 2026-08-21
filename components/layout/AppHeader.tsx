"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { logout } from "@/services/auth.service";
import { useSession } from "@/hooks/useSession";
import NotificationBell from "@/components/layout/NotificationBell";

export default function AppHeader() {
  const router = useRouter();

  // Platform-admin status comes from the platform_admins table
  // (migration 031), not from comparing the signed-in email against a
  // string in the source - that check used to live here.
  const { user, isPlatformAdmin } = useSession();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-ink-600 bg-ink-800 px-4 md:px-8">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-lg font-bold">🐙 Octopus ERP</h1>

          <p className="hidden text-xs text-mist md:block">
            Smart Business System
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />

        {isPlatformAdmin && (
          <Link
            href="/activity"
            className="rounded-lg bg-ink-700 px-3 py-2 text-sm transition hover:bg-ink-600"
          >
            📈
          </Link>
        )}

        {user?.role === "owner" && (
          <Link
            href="/settings"
            className="rounded-lg bg-ink-700 px-3 py-2 text-sm transition hover:bg-ink-600"
          >
            ⚙️
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="rounded-lg bg-ink-700 px-3 py-2 text-sm transition hover:bg-ink-600"
        >
          خروج
        </button>
      </div>
    </header>
  );
}
