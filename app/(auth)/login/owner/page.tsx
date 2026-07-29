"use client";

import { useState } from "react";
import Link from "next/link";

export default function OwnerLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">

      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">

        <div className="mb-8 text-center">

          <h1 className="text-4xl font-bold">
            👑 Owner Login
          </h1>

          <p className="mt-3 text-zinc-400">
            تسجيل دخول صاحب النشاط
          </p>

        </div>

        <div className="space-y-5">

          <div>

            <label className="mb-2 block text-sm text-zinc-300">
              البريد الإلكتروني أو رقم الهاتف
            </label>

            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="example@email.com"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-zinc-300">
              كلمة المرور
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            />

          </div>

          <button
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            تسجيل الدخول
          </button>

        </div>

        <div className="mt-6 flex justify-between text-sm">

          <Link
            href="/login"
            className="text-zinc-400 hover:text-white"
          >
            ← رجوع
          </Link>

          <button className="text-blue-400 hover:text-blue-300">
            نسيت كلمة المرور؟
          </button>

        </div>

      </div>

    </main>
  );
}