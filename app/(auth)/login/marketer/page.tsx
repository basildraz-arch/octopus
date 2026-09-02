"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Megaphone, ArrowRight } from "lucide-react";

import { signIn, signOut } from "@/repositories/auth.repository";
import { amIMarketer } from "@/repositories/marketer.repository";

// ============================================================
// دخول المسوّق — باب منفصل عن الباب بتاع أصحاب المحلات
// ============================================================
//
// كان ممكن نضيف فرع في شاشة الدخول العادية، بس الشاشة دي بتشتغل
// على محل حقيقي كل يوم - وأي تعديل فيها احتمال يقع دخول كيرو
// وموظفينه. الباب المنفصل بيخلّي المسوقين إضافة **مالهاش أي أثر**
// على اللي شغّال.
//
// وبعد الدخول فيه تحقق تاني: لو الحساب مش مسوّق، بنسجّل خروج على
// طول. من غير ده، صاحب محل يدخل من اللينك ده بالغلط ويلاقي نفسه
// في جلسة على شاشة فاضية ومش فاهم راح فين.
export default function MarketerLoginPage() {
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
      const { user } = await signIn(email, password);

      if (!user) throw new Error("تعذر تسجيل الدخول");

      if (!(await amIMarketer())) {
        await signOut();

        setError(
          "الحساب ده مش حساب مسوّق. لو انت صاحب محل، ادخل من صفحة الدخول العادية."
        );

        return;
      }

      router.push("/marketer");
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
          <h1 className="flex items-center justify-center gap-2 text-3xl font-bold text-paper">
            <Megaphone size={28} className="text-splash" />
            دخول المسوّقين
          </h1>

          <p className="mt-3 text-mist">
            شوف محلاتك وعمولتك
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-mist">
              البريد الإلكتروني
            </label>

            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-start text-paper outline-none transition focus:border-splash"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-mist">
              كلمة المرور
            </label>

            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-start text-paper outline-none transition focus:border-splash"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-splash py-3 font-semibold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
          >
            {loading ? "جارِ الدخول..." : "دخول"}
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
