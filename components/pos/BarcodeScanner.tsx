"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, CameraOff, Loader2, ScanBarcode } from "lucide-react";

// ============================================================
// مسح الباركود بكاميرا الموبايل
// ============================================================
//
// الفكرة: صاحب محل جديد يبدأ من غير ما يشتري ماسح. مش بديل
// للماسح الحقيقي في ساعة الزحمة — وده لازم يتقال في التسويق
// بصراحة، لأن المحل اللي هيكتشفه بنفسه هيزعل.
//
// ============================================================
// اللي المركّب ده **مابيعملوش** عن قصد
// ============================================================
//
// مابيقراش من قاعدة البيانات، ومابيضيفش في السلة، ومابيعرفش
// حاجة عن الأسعار.
//
// هو بيقرا رقم من الكاميرا وبيسلّمه للشاشة اللي فوقه، والشاشة
// دي هي اللي بتدوّر في الأصناف **المحمّلة في الذاكرة أصلًا**.
//
// ليه كده: عشان الفيتشر دي تفضل بره كل حاجة حسّاسة. مفيش جدول
// جديد، ولا دالة جديدة، ولا صلاحية جديدة، ولا حتة في مسار البيع
// بتتلمس. الكاميرا بتقرر **أنهي صنف يدخل السلة** وبس — والسعر
// والفاتورة والمخزون بيفضلوا بيمشوا على `record_sale` جوه
// القاعدة زي ما هم بالظبط.
//
// ============================================================
// التركيب
// ============================================================
//
//   npm install html5-qrcode
//
// والمكتبة بتتحمّل بـ`import()` ديناميكي **جوه** الإيفيكت، يعني
// مابتدخلش في حزمة شاشة البيع ومابتتحمّلش غير أول ما الكاشير
// يدوس الزرار فعلًا.
//
// ============================================================
// الاستعمال في `app/(pos)/sales/page.tsx`
// ============================================================
//
//   const [scanning, setScanning] = useState(false);
//
//   // بتدوّر في `items` المحمّلة، ومابتنادي القاعدة خالص.
//   function handleScan(code: string) {
//     const hit = items.find(
//       (i) => (i.barcode ?? "").trim() === code.trim()
//     );
//
//     if (!hit) return { ok: false, label: code };
//
//     selectItem(hit);              // نفس دالة الضغط على الصنف
//     return { ok: true, label: hit.name };
//   }
//
//   {scanning && (
//     <BarcodeScanner
//       onScan={handleScan}
//       onClose={() => setScanning(false)}
//     />
//   )}
//
// ملاحظة مهمة للتجربة: **الكاميرا مابتشتغلش غير على HTTPS**
// أو على `localhost`. لو بتجرّب من موبايل على سيرفر التطوير
// بالـIP المحلي (`192.168.x.x`)، المتصفح هيرفض من غير سبب
// واضح. جرّب على رابط المعاينة بتاع Vercel.

/** نتيجة البحث اللي الشاشة اللي فوق بترجّعها بعد كل قراءة. */
export type ScanOutcome = {
  /** اتلاقى صنف بالكود ده ولا لأ. */
  ok: boolean;
  /** اسم الصنف لو اتلاقى، أو الكود نفسه لو مالقاش. */
  label: string;
};

type Props = {
  /**
   * بتتنادى مع كل قراءة جديدة. **لازم تكون متزامنة وسريعة** —
   * البحث في مصفوفة محمّلة، مش استعلام.
   */
  onScan: (code: string) => ScanOutcome;
  onClose: () => void;

  /**
   * سطر صغير تحت العنوان، بيقول للكاشير هو بيبيع على أنهي تسعيرة.
   *
   * الكاميرا بتغطي الشاشة، فمختار التسعيرة اللي فوق بيختفي. ومن
   * غير السطر ده الكاشير ممكن يمسح عشرين صنف وهو فاكر إنه على
   * تسعيرة تانية - والفاتورة تتحسب صح بس بالسعر الغلط.
   */
  hint?: string;
};

const REGION_ID = "octopus-barcode-region";

/** نفس الكود يتقرا مرتين في ثانية عادي جدًا والكاميرا شغالة. */
const REPEAT_BLOCK_MS = 1500;

// ============================================================
// الصوت: من غير ملف
// ============================================================
//
// الكاشير بيبص على البضاعة مش على الشاشة. الصوت هو اللي بيقوله
// إن القراءة عدّت. ملف صوت كان معناه أصل زيادة يتحمّل، فبنولّد
// نغمة قصيرة من المتصفح نفسه.
function beep(ok: boolean) {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!Ctx) return;

    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // نغمة عالية قصيرة = تمام. نغمة واطية أطول = مش لاقيه.
    osc.frequency.value = ok ? 1320 : 320;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + (ok ? 0.12 : 0.3)
    );

    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.13 : 0.31));

    osc.onended = () => void ctx.close();
  } catch {
    // الصوت رفاهية. لو المتصفح رفض، المسح بيفضل شغال.
  }
}

function arabicCameraError(err: unknown): string {
  const text = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();

  if (text.includes("permission") || text.includes("notallowed")) {
    return "المتصفح رافض يفتح الكاميرا. اسمحله من إعدادات الموقع وجرّب تاني.";
  }

  if (text.includes("notfound") || text.includes("no camera")) {
    return "مفيش كاميرا على الجهاز ده.";
  }

  if (text.includes("secure") || text.includes("not supported")) {
    return "الكاميرا بتشتغل على المواقع الآمنة (HTTPS) بس. افتح الموقع من الرابط الأساسي.";
  }

  return "الكاميرا مافتحتش. اقفل وافتح تاني، ولو فضلت، اقفل أي تطبيق تاني بيستعملها.";
}

export default function BarcodeScanner({ onScan, onClose, hint }: Props) {
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState("");

  /** آخر ٤ قراءات — الكاشير بيتطمّن إن اللي مسحه دخل فعلًا. */
  const [log, setLog] = useState<(ScanOutcome & { at: number })[]>([]);

  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  // الدالة بتتغيّر مع كل رندر من الشاشة اللي فوق. لو حطّيناها في
  // مصفوفة اعتماد الإيفيكت، الكاميرا هتتقفل وتتفتح مع كل قراءة.
  // الـref بيخلّي الإيفيكت يشتغل **مرة واحدة** ويفضل شايف أحدث
  // نسخة من الدالة.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const handleCode = useCallback((code: string) => {
    const now = Date.now();
    const clean = code.trim();

    if (!clean) return;

    if (lastRef.current.code === clean && now - lastRef.current.at < REPEAT_BLOCK_MS) {
      return;
    }

    lastRef.current = { code: clean, at: now };

    const outcome = onScanRef.current(clean);

    beep(outcome.ok);
    navigator.vibrate?.(outcome.ok ? 40 : [60, 50, 60]);

    setLog((rows) => [{ ...outcome, at: now }, ...rows].slice(0, 4));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let instance: import("html5-qrcode").Html5Qrcode | null = null;

    async function start() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );

        if (cancelled) return;

        instance = new Html5Qrcode(REGION_ID, {
          verbose: false,

          // تحديد الصيغ بيسرّع القراءة بشكل محسوس: المكتبة
          // بتبطّل تجرّب عشرين صيغة على كل فريم. EAN و UPC دول
          // باركود المنتجات في السوبر ماركت، وCODE_128 اللي
          // المحلات بتطبعه لنفسها، وQR لأكواد الأخطبوط.
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        });

        await instance.start(
          { facingMode: "environment" },
          {
            fps: 12,

            // مستطيل عريض وواطي، مش مربع. باركود المنتج خطوط
            // أفقية طويلة — المربع بيخلي الكاشير يقرّب أوي عشان
            // يملاه، والتقريب بيوقّع التركيز على الموبايلات
            // الرخيصة.
            qrbox: (w: number, h: number) => ({
              width: Math.floor(Math.min(w * 0.92, 340)),
              height: Math.floor(Math.min(h * 0.45, 170)),
            }),
          },
          handleCode,
          () => {
            // فشل القراءة في كل فريم حاجة طبيعية وإحنا بنصوّب.
          }
        );

        if (!cancelled) setStarting(false);
      } catch (err) {
        if (!cancelled) {
          setError(arabicCameraError(err));
          setStarting(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;

      if (!instance) return;

      // `stop()` بترمي لو الكاميرا ماكانتش اشتغلت أصلًا (الحالة
      // اللي فيها المستخدم رفض الصلاحية). بنبلع الرمية — مفيش
      // حاجة تتعمل وقت الإغلاق.
      instance
        .stop()
        .then(() => instance?.clear())
        .catch(() => undefined);
    };
  }, [handleCode]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 md:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-ink-600 bg-ink-800 md:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-ink-600 p-4">
          <p className="min-w-0">
            <span className="flex items-center gap-2 font-bold text-paper">
              <ScanBarcode size={18} />
              صوّب على الباركود
            </span>

            {hint && (
              <span className="mt-0.5 block truncate text-xs text-splash">
                {hint}
              </span>
            )}
          </p>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-2 text-mist transition hover:bg-ink-700 hover:text-paper"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="relative overflow-hidden rounded-xl bg-ink-950">
            <div
              id={REGION_ID}
              className="aspect-[4/3] w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
            />

            {starting && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-mist">
                <Loader2 size={24} className="animate-spin" />
                بيفتح الكاميرا...
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <CameraOff size={28} className="text-red-400" />
                <p className="text-sm leading-relaxed text-paper">{error}</p>
              </div>
            )}
          </div>

          {/* الكاميرا بتفضل مفتوحة بعد كل قراءة عن قصد: السوبر
              ماركت بيمسح عشرين صنف ورا بعض، وقفل وفتح الكاميرا
              بين كل واحد والتاني بيخلي الفيتشر بطيئة أكتر من
              الكتابة باليد. */}
          {!error && (
            <p className="mt-3 text-center text-xs text-mist">
              الكاميرا هتفضل شغالة — امسح اللي انت عايزه ورا بعض،
              واقفل لما تخلص.
            </p>
          )}

          {log.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {log.map((row) => (
                <li
                  key={row.at}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                    row.ok
                      ? "bg-ink-900 text-paper"
                      : "border border-amber-900/70 bg-amber-950/20 text-amber-200"
                  }`}
                >
                  <span className="truncate">{row.label}</span>

                  <span className="shrink-0 text-xs opacity-80">
                    {row.ok ? "اتضاف" : "مش موجود"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* الكود اللي مالوش صنف مش خطأ في المسح — غالبًا بضاعة
              لسه مااتسجلتش. بنقول ده بدل ما نسيب الكاشير يفتكر
              إن الكاميرا بايظة. */}
          {log.some((row) => !row.ok) && (
            <p className="mt-2 text-center text-xs text-mist">
              الكود اللي مش موجود معناه إن الصنف لسه مااتسجّلش —
              ضيفه من شاشة الأصناف وحط الكود ده في خانة الباركود.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
