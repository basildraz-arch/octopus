import { ReactNode } from "react";

import DesktopSidebar from "@/components/layout/DesktopSidebar";
import MobileSidebar from "@/components/layout/MobileSidebar";
import AppHeader from "@/components/layout/AppHeader";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
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