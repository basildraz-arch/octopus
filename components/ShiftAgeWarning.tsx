"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { getOpenShift } from "@/repositories/shift.repository";
import { shiftAge, type ShiftAge } from "@/lib/shiftAge";
import { useSession } from "@/hooks/useSession";

// تنبيه إن اليوم مش متقفل.
//
// بيظهر لما الوردية المفتوحة تكون عدّت يومها. مابيمنعش أي حاجة —
// البيع لازم يفضل شغّال. بس اللي مش عارف إن يومه مش متقفل مش هيقفله.
//
// **ليه مش مودال بيقفل الشاشة:** الكاشير بيفتح الشاشة والزبون واقف
// قدامه. حاجة بتقفله الشاشة الساعة ٩ الصبح معناها إنه هيدوس "بعدين"
// من غير ما يقرا، وبعد أسبوع يبقى بيدوس "بعدين" أوتوماتيك. الشريط
// بيفضل باين لحد ما يتعمل، وde أنفع من مودال بيتقفل.
export default function ShiftAgeWarning() {
  const { user } = useSession();

  const [age, setAge] = useState<ShiftAge | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    getOpenShift(user.business_id)
      .then((shift) => {
        if (cancelled || !shift) return;

        const result = shiftAge(shift.opened_at);

        if (result.tooLong) setAge(result);
      })
      .catch(() => {
        // التنبيه مش وظيفة حرجة. لو مقدرش يقرا الوردية، مايعملش حاجة
        // — مايرميش رسالة خطأ فوق شاشة البيع.
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!age) return null;

  return (
    <Link
      href="/day-close"
      className="flex items-center gap-3 rounded-xl border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200 transition hover:bg-amber-950/60"
    >
      <CalendarClock size={18} className="shrink-0" />

      <span className="min-w-0">
        <span className="block font-semibold">{age.label}</span>

        <span className="block text-xs text-amber-300/80">
          جرد الدرج والتقارير بتتحسب من أول الوردية — اقفل اليوم عشان
          الأرقام ترجع تبقى يوم بيوم.
        </span>
      </span>
    </Link>
  );
}
