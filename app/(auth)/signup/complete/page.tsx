"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { supabase } from "@/lib/supabase";
import { finishSignup } from "@/services/auth.service";

const TIMEOUT_MS = 10000;

export default function SignupCompletePage() {
  const router = useRouter();

  const [error, setError] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    async function run() {
      if (ran.current) return;
      ran.current = true;

      try {
        await finishSignup();

        router.replace("/dashboard");
      } catch (err) {
        console.error(err);

        const message =
          err instanceof Error
            ? err.message
            : "حدث خطأ أثناء إكمال إنشاء الحساب";

        setError(message);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        run();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        run();
      }
    });

    const timeoutId = setTimeout(() => {
      if (!ran.current) {
        setTimedOut(true);
      }
    }, TIMEOUT_MS);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [router]);

  const displayError =
    error ||
    (timedOut
      ? "استغرق تفعيل الحساب وقتًا أطول من المتوقع. جرّب تدخل من رابط التأكيد في الإيميل تاني، أو سجّل دخولك مباشرة."
      : "");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-2xl">
        {displayError ? (
          <>
            <p className="text-5xl">⚠️</p>

            <p className="mt-4 text-red-400">
              {displayError}
            </p>

            <Link
              href="/login"
              className="mt-6 inline-block text-sm text-zinc-400 hover:text-white"
            >
              الرجوع لتسجيل الدخول
            </Link>
          </>
        ) : (
          <>
            <p className="text-5xl">⏳</p>

            <p className="mt-4 text-zinc-300">
              جارِ إعداد حسابك...
            </p>
          </>
        )}
      </div>
    </main>
  );
}
