"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/repositories/notification.repository";
import { useSession } from "@/hooks/useSession";
import type { AppNotification } from "@/types/notification";

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-ink-600 bg-ink-800",
  warning: "border-amber-700 bg-amber-950/30",
  danger: "border-red-700 bg-red-950/30",
};

const SEVERITY_ICONS: Record<string, string> = {
  info: "🔔",
  warning: "⚠️",
  danger: "🚨",
};

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

  if (minutes < 1) return "دلوقتي";
  if (minutes < 60) return `من ${minutes} دقيقة`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `من ${hours} ساعة`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "امبارح";

  return `من ${days} يوم`;
}

export default function NotificationsPage() {
  const { user, loading: sessionLoading } = useSession();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading || !user) return;

    load();
  }, [sessionLoading, user]);

  async function load() {
    setLoading(true);
    setNotifications(await getNotifications());
    setLoading(false);
  }

  async function handleRead(notification: AppNotification) {
    if (notification.read_at) return;

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, read_at: new Date().toISOString() }
          : item
      )
    );

    try {
      await markNotificationRead(notification.id);
    } catch {
      load();
    }
  }

  async function handleReadAll() {
    const now = new Date().toISOString();

    setNotifications((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? now }))
    );

    try {
      await markAllNotificationsRead();
    } catch {
      load();
    }
  }

  const unread = notifications.filter((n) => !n.read_at).length;

  if (loading) {
    return <main className="p-8 text-center text-mist">جارِ التحميل...</main>;
  }

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🔔 التنبيهات</h1>

        {unread > 0 && (
          <button
            onClick={handleReadAll}
            className="rounded-lg bg-ink-700 px-3 py-2 text-sm text-mist transition hover:bg-ink-600"
          >
            علّم الكل كمقروء
          </button>
        )}
      </div>

      {notifications.length === 0 && (
        <div className="rounded-2xl border border-ink-600 bg-ink-800 p-8 text-center">
          <p className="text-4xl">🎉</p>

          <p className="mt-3 text-mist">مفيش أي تنبيهات - كل حاجة تمام</p>
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((notification) => {
          const body = (
            <div
              className={`rounded-2xl border p-4 transition ${
                SEVERITY_STYLES[notification.severity] ?? SEVERITY_STYLES.info
              } ${notification.read_at ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">
                  {SEVERITY_ICONS[notification.severity] ?? "🔔"}
                </span>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-paper">{notification.title}</p>

                    <span className="shrink-0 text-xs text-mist">
                      {timeAgo(notification.created_at)}
                    </span>
                  </div>

                  {notification.body && (
                    <p className="mt-1 text-sm text-mist">{notification.body}</p>
                  )}
                </div>

                {!notification.read_at && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-splash" />
                )}
              </div>
            </div>
          );

          if (notification.link) {
            return (
              <Link
                key={notification.id}
                href={notification.link}
                onClick={() => handleRead(notification)}
                className="block"
              >
                {body}
              </Link>
            );
          }

          return (
            <button
              key={notification.id}
              onClick={() => handleRead(notification)}
              className="block w-full text-right"
            >
              {body}
            </button>
          );
        })}
      </div>
    </main>
  );
}
