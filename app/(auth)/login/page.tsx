"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">

      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

        <div className="mb-10 text-center">

          <h1 className="text-4xl font-bold">
            🐙 Octopus
          </h1>

          <p className="mt-3 text-zinc-400">
            اختر طريقة تسجيل الدخول
          </p>

        </div>

        <div className="space-y-5">

          <button
            onClick={() => router.push("/login/owner")}
            className="w-full rounded-2xl border border-blue-500 bg-blue-600/10 p-6 text-right transition hover:bg-blue-600/20"
          >
            <h2 className="text-xl font-bold">
              👑 صاحب النشاط
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              إدارة كاملة للنشاط والفروع والموظفين
            </p>
          </button>

          <button
            onClick={() => router.push("/login/employee")}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-800/50 p-6 text-right transition hover:bg-zinc-800"
          >
            <h2 className="text-xl font-bold">
              👨‍💼 موظف
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              الدخول إلى شاشة الكاشير والمبيعات
            </p>
          </button>

        </div>

        <div className="mt-8 flex justify-center text-sm">
          <Link
            href="/signup"
            className="text-zinc-400 hover:text-white"
          >
            مفيش حساب؟ سجّل بيزنسك الآن
          </Link>
        </div>

      </div>

    </main>
  );
}