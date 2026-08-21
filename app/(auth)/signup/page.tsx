"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Rocket, Mail, ArrowRight } from "lucide-react";

import { registerBusiness } from "@/services/auth.service";
import { getBusinessTemplates } from "@/repositories/businessTemplate.repository";
import {
  ALL_FEATURES,
  FEATURE_LABELS,
  FEATURE_ICONS,
  FEATURE_DESCRIPTIONS,
} from "@/lib/features";
import type { BusinessTemplate } from "@/types/businessTemplate";
import type { FeatureKey } from "@/types/business";

export default function SignupPage() {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);

  const [inviteCode, setInviteCode] = useState("");
  const [verifyingInvite, setVerifyingInvite] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Set when the code turned out to be a referrer's rather than the
  // house code. Carried all the way into signup so the referral is
  // recorded without anyone having to remember a second step.
  const [referralCode, setReferralCode] = useState("");
  const [referredBy, setReferredBy] = useState("");

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Loaded from the database, not from a list in this file, so that
  // editing a template in Master changes what new shops actually get.
  const [templates, setTemplates] = useState<BusinessTemplate[]>([]);
  const [businessType, setBusinessType] = useState<string>("");
  const [editedFeatures, setEditedFeatures] = useState<FeatureKey[]>([]);
  const [touchedFeatures, setTouchedFeatures] = useState(false);

  useEffect(() => {
    getBusinessTemplates().then(setTemplates);
  }, []);

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
        setReferralCode(data.referralCode ?? "");
        setReferredBy(data.referredBy ?? "");
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

  function handleShapeSelect(type: string) {
    const template = templates.find((t) => t.business_type === type);
    if (!template) return;

    setBusinessType(type);
    setEditedFeatures(template.enabled_features);
    setTouchedFeatures(false);
    setStep(3);
  }

  function handleToggleFeature(feature: FeatureKey) {
    setTouchedFeatures(true);

    setEditedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  }

  async function handleRegister() {
    setError("");

    if (!businessType) {
      setError("اختار نوع نشاطك الأول");
      return;
    }

    if (touchedFeatures && editedFeatures.length === 0) {
      setError("لازم تختار ميزة واحدة على الأقل");
      return;
    }

    setLoading(true);

    try {
      await registerBusiness({
        fullName,
        businessName,
        businessType,
        email,
        password,
        // Untouched means "use whatever the template says" - decided
        // server-side, where the template actually lives.
        enabledFeatures: touchedFeatures ? editedFeatures : undefined,
        referralCode: referralCode || undefined,
      });

      setStep(5);
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : "حدث خطأ أثناء إنشاء الحساب";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const subtitles: Record<0 | 1 | 2 | 3 | 4 | 5, string> = {
    0: "أدخل كود الدعوة للمتابعة",
    1: "سجّل بيزنسك الجديد",
    2: "اختار نوع نشاطك",
    3: "خطوة بسيطة وخلصنا",
    4: "عدّل الميزات اللي تحتاجها",
    5: "خطوة أخيرة وهتبقى جاهز",
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-ink-600 bg-ink-800 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold">Octopus</h1>

          <p className="mt-3 text-mist">{subtitles[step]}</p>
        </div>

        {step === 0 && (
          <form onSubmit={handleInviteSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-mist">
                كود الدعوة
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-paper outline-none transition focus:border-splash"
              />
            </div>

            {inviteError && (
              <p className="text-sm text-red-500">{inviteError}</p>
            )}

            <button
              type="submit"
              disabled={verifyingInvite}
              className="w-full rounded-xl bg-splash py-3 font-semibold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
            >
              {verifyingInvite ? "جارِ التحقق..." : "متابعة"}
            </button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-5">
            {referredBy && (
              <p className="rounded-xl border border-splash/40 bg-splash-dim p-3 text-center text-sm text-splash">
                جاي من عند {referredBy} 👋
              </p>
            )}

            <div>
              <label className="mb-2 block text-sm text-mist">
                اسمك
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-paper outline-none transition focus:border-splash"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-mist">
                اسم البيزنس
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-paper outline-none transition focus:border-splash"
              />
            </div>

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
                required
                className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-paper outline-none transition focus:border-splash"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-mist">
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-paper outline-none transition focus:border-splash"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-xl bg-splash py-3 font-semibold text-ink-950 transition hover:bg-splash-deep"
            >
              التالي
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-mist">
              اختر الشكل الأقرب لمحلك
            </p>

            {templates.length === 0 && (
              <p className="py-6 text-center text-mist">جارِ التحميل...</p>
            )}

            {templates.map((template) => (
              <button
                key={template.business_type}
                onClick={() => handleShapeSelect(template.business_type)}
                className="flex w-full items-center gap-4 rounded-2xl border border-ink-600 bg-ink-700/50 p-5 text-right transition hover:border-splash hover:bg-splash/10"
              >
                <span className="text-4xl">{template.icon}</span>
                <span>
                  <span className="block text-lg font-bold">
                    {template.label}
                  </span>
                  <span className="mt-1 block text-sm text-mist">
                    {template.description}
                  </span>
                </span>
              </button>
            ))}

            <button
              onClick={() => setStep(1)}
              className="flex w-full items-center justify-center gap-1 text-center text-sm text-mist hover:text-paper"
            >
              <ArrowRight size={14} />
              رجوع
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-center">
            <CheckCircle2 size={48} className="mx-auto text-splash" />

            <p className="text-mist">
              هنجهزلك حساب بيزنسك بالإعدادات المناسبة لنوع نشاطك تلقائيًا
            </p>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleRegister}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-splash py-4 text-lg font-bold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
            >
              {loading ? (
                "جارِ إنشاء الحساب..."
              ) : (
                <>
                  <Rocket size={20} />
                  ابدأ الآن
                </>
              )}
            </button>

            <button
              onClick={() => setStep(4)}
              disabled={loading}
              className="block w-full text-center text-sm text-mist hover:text-paper"
            >
              عايز تعدل الإعدادات؟
            </button>

            <button
              onClick={() => setStep(2)}
              disabled={loading}
              className="flex w-full items-center justify-center gap-1 text-center text-sm text-mist hover:text-paper"
            >
              <ArrowRight size={14} />
              رجوع
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <p className="text-sm text-mist">
              الميزات الموصى بها معلّمة تلقائيًا — عدّل زي ما يريحك
            </p>

            <div className="space-y-3">
              {ALL_FEATURES.map((feature) => (
                <label
                  key={feature}
                  className="flex items-start gap-3 rounded-lg border border-ink-600 bg-ink-900 p-3"
                >
                  <input
                    type="checkbox"
                    checked={editedFeatures.includes(feature)}
                    onChange={() => handleToggleFeature(feature)}
                    disabled={loading}
                    className="mt-1 h-5 w-5"
                  />
                  <span className="text-xl">{FEATURE_ICONS[feature]}</span>
                  <span>
                    <span className="block text-sm font-semibold">
                      {FEATURE_LABELS[feature]}
                    </span>
                    <span className="mt-1 block text-sm text-mist">
                      {FEATURE_DESCRIPTIONS[feature]}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {loading && (
              <p className="text-center text-sm text-mist">
                جارِ إنشاء الحساب...
              </p>
            )}

            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full rounded-xl bg-splash py-3 font-semibold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
            >
              إنشاء الحساب
            </button>

            <button
              onClick={() => setStep(3)}
              disabled={loading}
              className="flex w-full items-center justify-center gap-1 text-center text-sm text-mist hover:text-paper"
            >
              <ArrowRight size={14} />
              رجوع
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5 text-center">
            <Mail size={48} className="mx-auto text-splash" />

            <p className="text-mist">
              بعتنالك رابط تأكيد على{" "}
              <span className="font-semibold text-paper">{email}</span>.
              افتح بريدك ودوس على الرابط عشان تفعّل حسابك.
            </p>
          </div>
        )}

        {step !== 5 && (
          <div className="mt-6 flex justify-center text-sm">
            <Link href="/login" className="text-mist hover:text-paper">
              عندك حساب بالفعل؟ سجّل دخولك
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
