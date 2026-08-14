"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, Wallet } from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { logout } from "@/services/auth.service";
import AssistantChat from "@/components/assistant/AssistantChat";

const tabs = [
  { title: "بيع", href: "/sales", icon: ShoppingCart },
  { title: "مصروف", href: "/expenses", icon: Wallet },
];

export default function PosLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hasFeature, loading } = useSession();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!hasFeature("pos_sales")) {
      router.replace("/dashboard");
    }
  }, [loading, user, hasFeature, router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading || !user || !hasFeature("pos_sales")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 text-paper">
        جارِ التحميل...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 text-paper">

      <header className="flex items-center justify-between border-b border-ink-600 bg-ink-800 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">
            🐙 Octopus
          </h1>

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
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-lg bg-ink-700 px-3 py-2 text-sm hover:bg-ink-600 transition"
        >
          خروج
        </button>
      </header>

      <main className="p-4">
        {children}
      </main>

      <AssistantChat />

    </div>
  );
}
