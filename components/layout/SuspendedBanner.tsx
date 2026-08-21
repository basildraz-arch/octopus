"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { useSession } from "@/hooks/useSession";

// Says out loud what migration 065 now enforces silently.
//
// A suspended shop can still read everything, so without this the
// owner sees a normal, fully populated app and only discovers the
// problem when a sale fails with a database error. Telling them at
// the top of the screen - with the way out one tap away - is the
// difference between "the program is broken" and "I need to pay".
export default function SuspendedBanner() {
  const { suspended, user } = useSession();

  if (!suspended) return null;

  const isOwner = user?.role === "owner";

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200"
    >
      <AlertTriangle size={18} className="shrink-0" />

      <span className="flex-1">
        <strong className="font-bold">الاشتراك متوقف.</strong>{" "}
        تقدر تشوف بياناتك كلها، بس البيع والتعديل مقفولين لحد ما يتجدد.
      </span>

      {isOwner ? (
        <Link
          href="/subscribe"
          className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 font-bold text-ink-950"
        >
          جدّد الاشتراك
        </Link>
      ) : (
        <span className="shrink-0 text-amber-300/80">كلّم صاحب النشاط</span>
      )}
    </div>
  );
}
