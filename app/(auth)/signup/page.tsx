"use client";

import { useState } from "react";
import Link from "next/link";

import { registerBusiness } from "@/services/auth.service";
import { BUSINESS_TEMPLATES, type BusinessTemplateKey } from "@/lib/businessTemplates";
import { ALL_FEATURES, FEATURE_LABELS } from "@/lib/features";
import type { FeatureKey } from "@/types/business";

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

  const [selectedTemplate, setSelectedTemplate] =
    useState<BusinessTemplateKey | null>(null);
  const [editedFeatures, setEditedFeatures] = useState<FeatureKey[]>([]);

  function handleTemplateSelect(key: BusinessTemplateKey) {
    const template = BUSINESS_TEMPLATES.find((t) => t.key === key);
    if (!template) return;

    setSelectedTemplate(key);
    setEditedFeatures(template.features);
  }

  function handleToggleFeature(feature: FeatureKey) {
    setEditedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  }

  async function handleRegister() {
    setError("");

    if (editedFeatures.length === 0) {
      setError("لازم تختار ميزة واحدة على الأقل");
      return;
    }

    setLoading(true);

    try {
      await registerBusiness({
        fullName,
        businessName,
        email,
        password,
        enabledFeatures: editedFeatures,
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

        {step === 2 && !selectedTemplate && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              اختر النوع الأقرب لنشاطك — وهتقدر تعدّل الميزات بعد كده
            </p>

            {BUSINESS_TEMPLATES.map((template) => (
              <button
                key={template.key}
                onClick={() => handleTemplateSelect(template.key)}
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-800/50 p-6 text-right transition hover:border-blue-500 hover:bg-blue-600/10"
              >
                <h2 className="text-xl font-bold">{template.title}</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {template.description}
                </p>
              </button>
            ))}

            <button
              onClick={() => setStep(1)}
              className="w-full text-center text-sm text-zinc-400 hover:text-white"
            >
              ← رجوع
            </button>
          </div>
        )}

        {step === 2 && selectedTemplate && (
          <div className="space-y-5">
            <div>
              <p className="mb-3 text-sm text-zinc-400">
                الميزات المفعّلة — عدّل حسب احتياجك
              </p>

              <div className="space-y-3">
                {ALL_FEATURES.map((feature) => (
                  <label
                    key={feature}
                    className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950 p-3"
                  >
                    <input
                      type="checkbox"
                      checked={editedFeatures.includes(feature)}
                      onChange={() => handleToggleFeature(feature)}
                      disabled={loading}
                      className="h-5 w-5"
                    />
                    <span className="text-sm">{FEATURE_LABELS[feature]}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {loading && (
              <p className="text-center text-sm text-zinc-400">
                جارِ إنشاء الحساب...
              </p>
            )}

            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              إنشاء الحساب
            </button>

            <button
              onClick={() => setSelectedTemplate(null)}
              disabled={loading}
              className="w-full text-center text-sm text-zinc-400 hover:text-white"
            >
              ← تغيير القالب
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
