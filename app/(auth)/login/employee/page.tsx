"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { login } from "@/services/auth.service";

export default function EmployeeLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const user = await login(email, password);

      if (user.role === "owner") {
        router.push("/items");
      } else {
        router.push("/sales");
      }
    } catch (err) {
      console.error(err);
      setError("بيانات الدخول غير صحيحة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">

      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">

        <div className="mb-8 text-center">

          <h1 className="text-4xl font-bold">
            👨‍💼 دخول الموظف
          </h1>

          <p className="mt-3 text-zinc-400">
            الدخول إلى شاشة الكاشير والمبيعات
          </p>

        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >

          <div>

            <label className="mb-2 block text-sm text-zinc-300">
              البريد الإلكتروني
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
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
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            />

          </div>

          {error && (
            <p className="text-sm text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "جارِ الدخول..." : "تسجيل الدخول"}
          </button>

        </form>

        <div className="mt-6 flex justify-center text-sm">

          <Link
            href="/login"
            className="text-zinc-400 hover:text-white"
          >
            ← رجوع
          </Link>

        </div>

      </div>

    </main>
  );
}
