"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

import DesktopSidebar from "@/components/layout/DesktopSidebar";
import BottomNav from "@/components/layout/BottomNav";
import AppHeader from "@/components/layout/AppHeader";
import SuspendedBanner from "@/components/layout/SuspendedBanner";

import { useSession } from "@/hooks/useSession";
import { homePathFor } from "@/lib/permissions";
import { canOpen, contextFor, ruleFor } from "@/lib/navItems";

// The rules themselves live in lib/navItems.ts alongside the tiles
// and the sidebar, so "what a stock keeper can open" has exactly one
// answer - and the Master preview can ask that same question about
// somebody else's shop without a second copy to fall out of date.

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, business, isPlatformAdmin, loading } = useSession();

  const ctx = contextFor(user, business, isPlatformAdmin);

  const rule = ruleFor(pathname);

  // Kept apart because they send the person to the same place for
  // different reasons: a missing feature is the shop's shape, a
  // missing permission is this person's job.
  const blockedByFeature =
    !!user && !!rule?.feature && !ctx.features.includes(rule.feature);

  const blockedByRole = !!user && !blockedByFeature && !canOpen(pathname, ctx);

  const allowed = !!user && !blockedByFeature && !blockedByRole;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (blockedByRole) {
      router.replace(homePathFor(user));
      return;
    }

    if (blockedByFeature) {
      router.replace(homePathFor(user));
    }
  }, [loading, user, blockedByRole, blockedByFeature, router]);

  if (loading || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 text-paper">
        جارِ التحميل...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-ink-950 text-paper">
      <DesktopSidebar />

      <div className="flex flex-1 flex-col">
        <AppHeader />

        <SuspendedBanner />

        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
