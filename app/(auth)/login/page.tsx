"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Lottie from "lottie-react";

export default function LoginPage() {
  const router = useRouter();
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    fetch("/hebr-animation.json")
      .then((res) => res.json())
      .then(setAnimationData)
      .catch(() => setAnimationData(null));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6">

      <div className="w-full max-w-lg rounded-2xl border border-ink-600 bg-ink-800 p-8">

        <div className="mb-10 flex flex-col items-center text-center">

          {animationData ? (
            <Lottie
              animationData={animationData}
              loop
              autoplay
              style={{ width: 160, height: 160 }}
            />
          ) : (
            <img
              src="/hebr-final-1.jpg"
              alt="حبر"
              className="h-[160px] w-[160px] rounded-full object-cover shadow-lg"
            />
          )}

          <h1 className="mt-5 text-3xl font-bold text-paper">
            Octopus
          </h1>

          <p className="mt-3 text-mist">
            اختر طريقة تسجيل الدخول
          </p>

        </div>

        <div className="space-y-5">

          <button
            onClick={() => router.push("/login/owner")}
            className="w-full rounded-2xl border border-splash bg-splash/10 p-6 text-right transition hover:bg-splash/20"
          >
            <h2 className="text-xl font-bold">
              👑 صاحب النشاط
            </h2>

            <p className="mt-2 text-sm text-mist">
              إدارة كاملة للنشاط والفروع والموظفين
            </p>
          </button>

          <button
            onClick={() => router.push("/login/employee")}
            className="w-full rounded-2xl border border-ink-600 bg-ink-800/50 p-6 text-right transition hover:bg-ink-700"
          >
            <h2 className="text-xl font-bold">
              👨‍💼 موظف
            </h2>

            <p className="mt-2 text-sm text-mist">
              الدخول إلى شاشة الكاشير والمبيعات
            </p>
          </button>

        </div>

        <div className="mt-8 flex justify-center text-sm">
          <Link
            href="/signup"
            className="text-mist hover:text-paper"
          >
            مفيش حساب؟ سجّل بيزنسك الآن
          </Link>
        </div>

      </div>

    </main>
  );
}
