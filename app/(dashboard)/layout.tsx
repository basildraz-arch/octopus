"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

import DesktopSidebar from "@/components/layout/DesktopSidebar";
import BottomNav from "@/components/layout/BottomNav";
import AppHeader from "@/components/layout/AppHeader";
import AssistantChat from "@/components/assistant/AssistantChat";

import { useSession } from "@/hooks/useSession";
import type { FeatureKey } from "@/types/business";

const PATH_FEATURES: Record<string, FeatureKey> = {
  "/day-close": "shifts",
  "/sales-log": "pos_sales",
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hasFeature, loading } = useSession();

  const requiredFeature = PATH_FEATURES[pathname];
  const isBlockedByFeature = requiredFeature ? !hasFeature(requiredFeature) : false;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "owner") {
      router.replace("/sales");
      return;
    }

    if (isBlockedByFeature) {
      router.replace("/dashboard");
    }
  }, [loading, user, isBlockedByFeature, router]);

  if (
    loading ||
    !user ||
    user.role !== "owner" ||
    isBlockedByFeature
  ) {
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

        {/* Page */}
        <main className="flex-1 p-6 pb-24 md:p-8 md:pb-8">
          {children}
        </main>
      </div>

      {/* Bottom Navigation (mobile only) */}
      <BottomNav />

      <AssistantChat />
    </div>
  );
}
