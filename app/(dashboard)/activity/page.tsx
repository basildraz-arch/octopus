"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

import {
  getActivityByDate,
  type UserActivitySummary,
} from "@/repositories/activity.repository";

function todayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours} س ${minutes} د`;
}

export default function ActivityPage() {
  const [date, setDate] = useState(todayString());
  const [data, setData] = useState<UserActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [date]);

  async function load() {
    setLoading(true);

    const result = await getActivityByDate(date);

    setData(result);
    setLoading(false);
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Activity size={28} />
          نشاط المستخدمين
        </h1>

        <p className="mt-1 text-mist">
          صفحة شخصية - غير مرتبطة بأي بيزنس محدد
        </p>
      </div>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl border border-ink-600 bg-ink-800 p-4 text-paper outline-none"
      />

      {loading ? (
        <div className="p-8 text-center text-mist">
          جارِ التحميل...
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
          لا يوجد نشاط في هذا اليوم
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((row) => (
            <div
              key={row.userId}
              className="rounded-xl border border-ink-600 bg-ink-800 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-paper">
                  {row.userName}
                </span>

                <span className="text-xs text-mist">
                  {row.businessName}
                </span>
              </div>

              <div className="mt-2 flex justify-between text-sm text-mist">
                <span>أول نشاط: {formatTime(row.firstActivity)}</span>
                <span>آخر نشاط: {formatTime(row.lastActivity)}</span>
              </div>

              <div className="mt-2 text-center font-bold text-splash">
                المدى التقريبي: {formatDuration(row.firstActivity, row.lastActivity)}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
