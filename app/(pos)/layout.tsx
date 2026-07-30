"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/hooks/useSession";
import { logout } from "@/services/auth.service";

export default function PosLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        جارِ التحميل...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <h1 className="text-lg font-bold">
          🐙 Octopus
        </h1>

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
