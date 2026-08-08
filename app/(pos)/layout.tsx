"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

import { useSession } from "@/hooks/useSession";
import { logout } from "@/services/auth.service";

const tabs = [
  { title: "🛒 بيع", href: "/sales" },
  { title: "💸 مصروف", href: "/expenses" },
];

export default function PosLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, business, loading } = useSession();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (business?.app_mode === "warehouse_management") {
      router.replace("/dashboard");
    }
  }, [loading, user, business, router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading || !user || business?.app_mode === "warehouse_management") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        جارِ التحميل...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">
            🐙 Octopus
          </h1>

          <nav className="flex gap-2">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  pathname === tab.href
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                {tab.title}
              </Link>
            ))}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 transition"
        >
          خروج
        </button>
      </header>

      <main className="p-4">
        {children}
      </main>

      {/* مساحة محجوزة لمساعد الأخطبوط الذكي - هتتفعل في مرحلة لاحقة */}
      <div className="fixed bottom-4 left-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl shadow-lg">
        🐙
      </div>

    </div>
  );
}
