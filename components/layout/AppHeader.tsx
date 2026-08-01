"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { logout } from "@/services/auth.service";
import { useSession } from "@/hooks/useSession";

const ADMIN_EMAIL = "basildraz@gmail.com";

export default function AppHeader() {
  const router = useRouter();
  const { user } = useSession();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 md:px-8">

      <div className="flex items-center gap-4">

        <div>
          <h1 className="text-lg font-bold">
            🐙 Octopus ERP
          </h1>

          <p className="hidden text-xs text-zinc-400 md:block">
            Smart Business System
          </p>
        </div>

      </div>

      <div className="flex items-center gap-3">

        {user?.email === ADMIN_EMAIL && (
          <Link
            href="/activity"
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 transition"
          >
            📈
          </Link>
        )}

        <Link
          href="/settings"
          className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 transition"
        >
          ⚙️
        </Link>

        <button
          onClick={handleLogout}
          className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 transition"
        >
          خروج
        </button>

      </div>

    </header>
  );
}