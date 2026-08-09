"use client";

import { useState } from "react";
import Link from "next/link";

import { registerBusiness } from "@/services/auth.service";

type AppMode = "retail" | "warehouse_management";

export default function SignupPage() {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  const [inviteCode, setInviteCode] = useState("");
  const [verifyingInvite, setVerifyingInvite] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();

    setInviteError("");
    setVerifyingInvite(true);

    try {
      const res = await fetch("/api/signup/verify-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode }),
      });

      const data = await res.json();

      if (data.valid) {
        setStep(1);
      } else {
        setInviteError("كود الدعوة غير صحيح");
      }
    } catch (err) {
      console.error(err);
      setInviteError("حدث خطأ أثناء التحقق من الكود");
    } finally {
      setVerifyingInvite(false);
    }
  }

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    if (password.length < 6) {
      setError("كلمة المرور لازم تكون 6 حروف أو أرقام على الأقل");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }

    setStep(2);
  }

  async function handleAppModeSelect(mode: AppMode) {
    setError("");
    setLoading(true);

    try {
      await registerBusiness({
        fullName,
        businessName,
        email,
        password,
        appMode: mode,
      });

      setStep(3);
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : "حدث خطأ أثناء إنشاء الحساب";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold">
            🐙 Octopus
          </h1>

          <p className="mt-3 text-zinc-400">
            {step === 0
              ? "أدخل كود الدعوة للمتابعة"
              : step === 3
              ? "خطوة أخيرة وهتبقى جاهز"
              : "سجّل بيزنسك الجديد"}
          </p>
        </div>

        {step === 0 && (
          <form onSubmit={handleInviteSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                كود الدعوة
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            {inviteError && (
              <p className="text-sm text-red-500">{inviteError}</p>
            )}

            <button
              type="submit"
              disabled={verifyingInvite}
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {verifyingInvite ? "جارِ التحقق..." : "متابعة"}
            </button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                اسمك
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                اسم البيزنس
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

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
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              التالي
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <button
              onClick={() => handleAppModeSelect("retail")}
              disabled={loading}
              className="w-full rounded-2xl border border-blue-500 bg-blue-600/10 p-6 text-right transition hover:bg-blue-600/20 disabled:opacity-50"
            >
              <h2 className="text-xl font-bold">🛍️ بيزنس عادي</h2>
              <p className="mt-2 text-sm text-zinc-400">
                بيع مباشر، نقطة بيع، شيفتات، تقارير مبيعات
              </p>
            </button>

            <button
              onClick={() => handleAppModeSelect("warehouse_management")}
              disabled={loading}
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-800/50 p-6 text-right transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <h2 className="text-xl font-bold">🏭 إدارة مخازن</h2>
              <p className="mt-2 text-sm text-zinc-400">
                مخازن، أصناف، ونقل مخزون - من غير نقطة بيع
              </p>
            </button>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {loading && (
              <p className="text-center text-sm text-zinc-400">
                جارِ إنشاء الحساب...
              </p>
            )}

            <button
              onClick={() => setStep(1)}
              disabled={loading}
              className="w-full text-center text-sm text-zinc-400 hover:text-white"
            >
              ← رجوع
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 text-center">
            <p className="text-5xl">📧</p>
            <p className="text-zinc-300">
              بعتنالك رابط تأكيد على{" "}
              <span className="font-semibold text-white">{email}</span>.
              افتح بريدك ودوس على الرابط عشان تفعّل حسابك.
            </p>
          </div>
        )}

        {step !== 3 && (
          <div className="mt-6 flex justify-center text-sm">
            <Link href="/login" className="text-zinc-400 hover:text-white">
              عندك حساب بالفعل؟ سجّل دخولك
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
