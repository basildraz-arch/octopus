"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

import DesktopSidebar from "@/components/layout/DesktopSidebar";
import MobileSidebar from "@/components/layout/MobileSidebar";
import AppHeader from "@/components/layout/AppHeader";

import { useSession } from "@/hooks/useSession";

export default function DashboardLayout({
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
      return;
    }

    if (user.role !== "owner") {
      router.replace("/sales");
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== "owner") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        جارِ التحميل...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      <div className="flex flex-1 flex-col">
        {/* Header */}
        <AppHeader />

        {/* Mobile Sidebar */}
        <div className="border-b border-zinc-800 bg-zinc-900 p-4 md:hidden">
          <MobileSidebar />
        </div>

        {/* Page */}
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
