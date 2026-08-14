"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserCog, ArrowRight } from "lucide-react";

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
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6">

      <div className="w-full max-w-md rounded-2xl border border-ink-600 bg-ink-800 p-8 shadow-2xl">

        <div className="mb-8 text-center">

          <h1 className="flex items-center justify-center gap-2 text-4xl font-bold">
            <UserCog size={32} />
            دخول الموظف
          </h1>

          <p className="mt-3 text-mist">
            الدخول إلى شاشة الكاشير والمبيعات
          </p>

        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >

          <div>

            <label className="mb-2 block text-sm text-mist">
              البريد الإلكتروني
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-paper outline-none transition focus:border-splash"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-mist">
              كلمة المرور
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-paper outline-none transition focus:border-splash"
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
            className="w-full rounded-xl bg-splash py-3 font-semibold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
          >
            {loading ? "جارِ الدخول..." : "تسجيل الدخول"}
          </button>

        </form>

        <div className="mt-6 flex justify-center text-sm">

          <Link
            href="/login"
            className="flex items-center gap-1 text-mist hover:text-paper"
          >
            <ArrowRight size={14} />
            رجوع
          </Link>

        </div>

      </div>

    </main>
  );
}
