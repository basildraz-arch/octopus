"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";

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
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6">
      <div className="w-full max-w-md rounded-2xl border border-ink-600 bg-ink-800 p-8 text-center shadow-2xl">
        {displayError ? (
          <>
            <AlertTriangle size={48} className="mx-auto text-red-400" />

            <p className="mt-4 text-red-400">
              {displayError}
            </p>

            <Link
              href="/login"
              className="mt-6 inline-block text-sm text-mist hover:text-paper"
            >
              الرجوع لتسجيل الدخول
            </Link>
          </>
        ) : (
          <>
            <Loader2 size={48} className="mx-auto animate-spin text-splash" />

            <p className="mt-4 text-mist">
              جارِ إعداد حسابك...
            </p>
          </>
        )}
      </div>
    </main>
  );
}
