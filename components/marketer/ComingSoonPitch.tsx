"use client";

import { useState } from "react";
import { Clock, Check, Send } from "lucide-react";

import { logVerticalInterest } from "@/repositories/verticalInterest.repository";
import type { ComingSoonVertical } from "@/lib/demoShops";

// ============================================================
// «البرنامج لسه مابيعملش ده»
// ============================================================
//
// الشاشة دي بتقول للمسوّق **قف**. وde مقصود.
//
// أسهل حاجة كانت نخفي المجالات دي خالص، أو نسيب المسوّق يقول
// "أيوة بيعمل كده" ويشوف بعدين. الاتنين غلط:
//
//   الإخفاء بيضيّع المعلومة — عشرين جيم سألوا في شهر ده رقم يبني
//   عليه قرار، وأحسن من تخمين إن "الجيمات سوق كبير".
//
//   والوعد الكاذب بيوقّع محل في مشكلة، والمحل ده بيبقى أول واحد
//   يشتكي ويمشي. **وسمعتك في بلد صغيّرة أغلى من اشتراك.**
//
// فالشاشة بتدّي المسوّق حاجة يعملها بدل الوعد: يسجّل الاهتمام
// ويقول "هكلمك أول ما تنزل". ده بيحفظ العلاقة ومابيكدبش.
export default function ComingSoonPitch({
  vertical,
}: {
  vertical: ComingSoonVertical;
}) {
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy) return;

    setError("");

    if (!shopName.trim()) {
      setError("اكتب اسم المحل");
      return;
    }

    setBusy(true);

    try {
      await logVerticalInterest({
        vertical: vertical.key,
        shopName: shopName.trim(),
        phone: phone.trim() || undefined,
        note: note.trim() || undefined,
      });

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر التسجيل");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-green-900 bg-green-950/20 p-6 text-center">
        <Check size={32} className="mx-auto text-green-400" />

        <p className="mt-3 font-bold text-paper">اتسجّل</p>

        <p className="mt-1 text-sm text-mist">
          قوله: «لسه بيتعمل، وأول ما ينزل هكلمك.» ومتقولش تاريخ.
        </p>

        <button
          onClick={() => {
            setDone(false);
            setShopName("");
            setPhone("");
            setNote("");
          }}
          className="mt-4 rounded-xl bg-ink-700 px-5 py-2.5 text-sm font-semibold text-paper hover:bg-ink-600"
        >
          سجّل واحد تاني
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* السطر ده أهم حاجة في الشاشة: المسوّق لازم يقراه قبل ما
          يفتح بقه. */}
      <div className="rounded-2xl border border-amber-900/70 bg-amber-950/15 p-5">
        <p className="flex items-center gap-2 font-bold text-amber-200">
          <Clock size={18} />
          البرنامج لسه مابيعملش ده
        </p>

        <p className="mt-2 text-sm leading-relaxed text-paper">
          {vertical.label} محتاج{" "}
          <span className="font-bold text-amber-200">{vertical.missing}</span> —
          ودي حاجات لسه مش موجودة.
        </p>

        <p className="mt-3 rounded-xl bg-ink-900 p-3 text-xs leading-relaxed text-mist">
          <span className="font-bold text-paper">ما توعدش.</span> لو قلتله
          «أيوة بيعمل كده» وسجّلته، هيكتشف بنفسه بعد أسبوع، وهيمشي، وهيقول
          لكل معارفه. سجّل اهتمامه وقوله الحقيقة: لسه بيتعمل.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <p className="mb-1 font-bold text-paper">سجّل اهتمامه</p>

        <p className="mb-4 text-xs text-mist">
          بيوصل للإدارة على طول. لو الطلب كتر، ده بيتبني.
        </p>

        <div className="space-y-3">
          <input
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="اسم المحل"
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none focus:border-splash"
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="تليفونه (اختياري)"
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none focus:border-splash"
          />

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="محتاج إيه بالظبط؟ (اختياري)"
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none focus:border-splash"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={submit}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-splash p-3 font-bold text-ink-950 transition hover:opacity-90 disabled:opacity-50"
          >
            <Send size={16} />
            {busy ? "بيتسجّل..." : "سجّل"}
          </button>
        </div>
      </div>
    </div>
  );
}
