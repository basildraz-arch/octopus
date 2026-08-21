"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { getUnreadCount } from "@/repositories/notification.repository";
import { useSession } from "@/hooks/useSession";

const REFRESH_MS = 60_000;

// A bell with a number on it. Nothing more - tapping it opens the
// list, and the list is where anything gets read or dismissed.
export default function NotificationBell() {
  const pathname = usePathname();
  const { user, loading } = useSession();

  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;

    async function refresh() {
      const count = await getUnreadCount();

      if (!cancelled) setUnread(count);
    }

    refresh();

    const timer = setInterval(refresh, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loading, user, pathname]);

  if (!user) return null;

  return (
    <Link
      href="/notifications"
      aria-label="التنبيهات"
      className="relative rounded-lg bg-ink-700 px-3 py-2 text-sm transition hover:bg-ink-600"
    >
      🔔
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
