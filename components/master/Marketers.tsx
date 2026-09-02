"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  RefreshCw,
  Wallet,
  Store,
  Pause,
  Play,
  Copy,
  Check,
  MonitorPlay,
  ExternalLink,
  Clock,
} from "lucide-react";

import {
  getMarketers,
  runMarketerAction,
  type MarketerRow,
  type VerticalInterestRow,
} from "@/services/master.service";
import { COMING_SOON } from "@/lib/demoShops";
import { useToast } from "@/hooks/useToast";

// حروف وأرقام من غير O و0 و I و1: الكود بيتقال في التليفون، وكود
// بيتسمع غلط بيضيّع إحالة.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function suggestCode(length = 6) {
  let out = "";

  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }

  return out;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-900 p-3 text-start transition hover:border-splash"
    >
      <span>
        <span className="block text-xs text-mist">{label}</span>
        <span dir="ltr" className="block font-bold text-paper">
          {value}
        </span>
      </span>

      {copied ? (
        <Check size={16} className="text-green-400" />
      ) : (
        <Copy size={16} className="text-mist" />
      )}
    </button>
  );
}

export default function Marketers() {
  const toast = useToast();

  const [rows, setRows] = useState<MarketerRow[]>([]);
  const [interest, setInterest] = useState<VerticalInterestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(suggestCode());
  const [reward, setReward] = useState("500");

  // بيانات الدخول بتتعرض **مرة واحدة بعد الإنشاء**. كلمة السر
  // مش متخزّنة في أي مكان نقدر نقراها تاني - Supabase بيخزّن
  // hash - فلو باسل قفل الشاشة قبل ما ينسخها، الحل الوحيد إنه
  // يعمل حساب جديد.
  const [created, setCreated] = useState<{
    email: string;
    password: string;
    code: string;
  } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const data = await getMarketers();

      setRows(data.marketers);
      setInterest(data.interest);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر التحميل");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (busy) return;

    setBusy(true);

    try {
      await runMarketerAction({
        action: "create",
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        code: code.trim().toUpperCase(),
        phone: phone.trim() || undefined,
        signupReward: Number(reward),
      });

      setCreated({
        email: email.trim(),
        password,
        code: code.trim().toUpperCase(),
      });

      setFullName("");
      setPhone("");
      setEmail("");
      setPassword("");
      setCode(suggestCode());
      setAdding(false);

      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إنشاء المسوّق");
    } finally {
      setBusy(false);
    }
  }

  async function handleSettle(row: MarketerRow) {
    if (busy) return;

    setBusy(true);

    try {
      const result = await runMarketerAction({
        action: "settle",
        marketerId: row.id,
      });

      toast.success(`اتسجّل صرف ${result.amount?.toFixed(2)} ج لـ${row.fullName}`);

      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الصرف");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(row: MarketerRow) {
    if (busy) return;

    setBusy(true);

    try {
      await runMarketerAction({
        action: "set_active",
        marketerId: row.id,
        active: !row.active,
      });

      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر التعديل");
    } finally {
      setBusy(false);
    }
  }

  const totalDue = rows.reduce((sum, row) => sum + row.due, 0);

  // الطلبات متجمّعة بالمجال: عشرين طلب على الجيمات رقم يتبنى
  // عليه قرار، وعشرين سطر متفرقين مجرد قايمة.
  const byVertical = COMING_SOON.map((v) => ({
    ...v,
    rows: interest.filter((row) => row.vertical === v.key),
  }))
    .filter((v) => v.rows.length > 0)
    .sort((a, b) => b.rows.length - a.rows.length);

  return (
    <div className="space-y-4">
      {/* الرقم ده أول حاجة تتشاف: ده اللي عليك دلوقتي. */}
      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <p className="text-sm text-mist">مستحقات المسوقين دلوقتي</p>

        <p className="mt-1 text-3xl font-bold text-amber-300">
          {totalDue.toFixed(2)} ج
        </p>

        <p className="mt-1 text-xs text-mist">
          عمولات محلات{" "}
          <span className="font-bold text-paper">دفعت اشتراكها</span> ولسه ما
          اتصرفتش. المحل اللي سجّل وما دفعش مابيدخلش هنا.
        </p>
      </div>

      {created && (
        <div className="space-y-3 rounded-xl border border-splash/50 bg-ink-800 p-5">
          <p className="font-bold text-paper">
            الحساب اتعمل — ابعت البيانات دي للمسوّق دلوقتي
          </p>

          <p className="text-xs text-amber-300">
            كلمة السر دي مش هتظهر تاني. لو قفلت الشاشة من غير ما
            تنسخها، هتحتاج تعمل حساب جديد.
          </p>

          <CopyField label="لينك الدخول" value={`${typeof window !== "undefined" ? window.location.origin : ""}/login/marketer`} />
          <CopyField label="الإيميل" value={created.email} />
          <CopyField label="كلمة السر" value={created.password} />
          <CopyField label="كود الإحالة" value={created.code} />

          <button
            onClick={() => setCreated(null)}
            className="w-full rounded-xl bg-ink-700 p-3 text-sm font-semibold text-paper hover:bg-ink-600"
          >
            نسختهم خلاص
          </button>
        </div>
      )}

      {/* ============================================================
          معاينة من غير تسجيل خروج
          ============================================================

          باسل: "عايز أجرّب من غير ما أضطر أقفل الأكونت."

          شاشة العرض بتاعة المسوّق **مالهاش حارس دخول أصلًا** - هي
          بيانات ثابتة في `lib/demoShops.ts`، مفيش فيها ولا استعلام
          ولا صف من أي محل. فبتتفتح وانت داخل بحسابك عادي.

          أما شاشة المسوّق نفسها (فلوسه ومحلاته) فهي بتقرا
          `marketer_dashboard()` اللي بتشوف مين انت من الجلسة -
          ودي **مش هنعملها معاينة**. المعاينة معناها إن الكود يثق
          في حاجة جاية من الشاشة بدل الجلسة، وde بالظبط الباب اللي
          كل الحوار بتاع الصلاحيات قافله. النافذة الخاصة في
          المتصفح بتحل الموضوع في ثانية من غير ما نفتحه. */}
      <div className="rounded-xl border border-ink-600 bg-ink-800/60 p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-paper">
          <MonitorPlay size={16} className="text-splash" />
          جرّب من غير ما تقفل حسابك
        </p>

        <Link
          href="/marketer/demo"
          target="_blank"
          className="flex items-center justify-between gap-2 rounded-lg border border-ink-600 bg-ink-900 p-3 transition hover:border-splash"
        >
          <span>
            <span className="block text-sm font-semibold text-paper">
              شاشة العرض بتاعة المسوّق
            </span>

            <span className="block text-xs text-mist">
              ١٠ أنواع نشاط — بتفتح في تاب جديد وانت داخل بحسابك
            </span>
          </span>

          <ExternalLink size={15} className="shrink-0 text-mist" />
        </Link>

        <p className="mt-2 text-xs leading-relaxed text-mist">
          وعشان تشوف شاشة المسوّق نفسها (فلوسه ومحلاته)، افتح{" "}
          <span className="font-semibold text-paper">نافذة خاصة</span> في
          المتصفح وادخل بحسابه من{" "}
          <span dir="ltr" className="font-semibold text-paper">
            /login/marketer
          </span>
          . كده حسابك هنا يفضل مفتوح.
        </p>
      </div>

      {!adding ? (
        <div className="flex gap-2">
          <button
            onClick={() => setAdding(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-splash p-3 font-bold text-ink-950 transition hover:opacity-90"
          >
            <Plus size={18} />
            مسوّق جديد
          </button>

          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-ink-600 bg-ink-800 px-4 text-mist transition hover:border-splash disabled:opacity-50"
            aria-label="تحديث"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h3 className="font-bold text-paper">مسوّق جديد</h3>

          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="الاسم"
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="التليفون (اختياري)"
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
          />

          <input
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-start text-paper outline-none"
          />

          <input
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة السر (٨ حروف على الأقل)"
            className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-start text-paper outline-none"
          />

          <div className="flex gap-2">
            <input
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="flex-1 rounded-xl border border-ink-600 bg-ink-900 p-3 text-start font-bold text-paper outline-none"
            />

            <button
              type="button"
              onClick={() => setCode(suggestCode())}
              className="rounded-xl border border-ink-600 bg-ink-900 px-4 text-sm text-mist hover:border-splash"
            >
              كود تاني
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs text-mist">
              عمولته على كل محل (بالجنيه)
            </label>

            <input
              type="number"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={busy}
              className="flex-1 rounded-xl bg-splash p-3 font-bold text-ink-950 disabled:opacity-50"
            >
              {busy ? "بيتعمل..." : "اعمل الحساب"}
            </button>

            <button
              onClick={() => setAdding(false)}
              disabled={busy}
              className="rounded-xl bg-ink-700 px-5 font-semibold text-paper disabled:opacity-50"
            >
              رجوع
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="p-6 text-center text-mist">جارِ التحميل...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-ink-600 bg-ink-800 p-6 text-center text-mist">
          مفيش مسوقين لسه.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const isOpen = openRow === row.id;

            return (
              <div
                key={row.id}
                className={`rounded-xl border p-4 ${
                  row.active
                    ? "border-ink-600 bg-ink-800"
                    : "border-ink-700 bg-ink-900/60 opacity-70"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold text-paper">
                      <Megaphone size={16} className="text-splash" />
                      {row.fullName}
                      {!row.active && (
                        <span className="rounded bg-ink-700 px-2 py-0.5 text-xs text-mist">
                          متوقف
                        </span>
                      )}
                    </p>

                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist">
                      <span dir="ltr" className="font-bold text-splash">
                        {row.code}
                      </span>
                      <span>{row.rewardEach} ج للمحل</span>
                      {row.phone && <span dir="ltr">{row.phone}</span>}
                    </p>
                  </div>

                  <div className="text-end">
                    <p className="text-xl font-bold text-amber-300">
                      {row.due.toFixed(2)} ج
                    </p>
                    <p className="text-xs text-mist">مستحق</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mist">
                  <span className="flex items-center gap-1">
                    <Store size={12} />
                    {row.signedUpCount} محل سجّل
                  </span>

                  <span>{row.paidCount} منهم دفع</span>

                  <span className="flex items-center gap-1">
                    <Wallet size={12} />
                    اتصرفله {row.settled.toFixed(2)} ج
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSettle(row)}
                    disabled={busy || row.due <= 0}
                    className="flex-1 rounded-xl bg-green-600 p-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-40"
                  >
                    {row.due > 0
                      ? `سجّل صرف ${row.due.toFixed(2)} ج`
                      : "مفيش مستحقات"}
                  </button>

                  <button
                    onClick={() => handleToggle(row)}
                    disabled={busy}
                    className="rounded-xl border border-ink-600 bg-ink-900 px-4 text-mist transition hover:border-splash disabled:opacity-50"
                    aria-label={row.active ? "إيقاف" : "تفعيل"}
                  >
                    {row.active ? <Pause size={16} /> : <Play size={16} />}
                  </button>

                  {row.shops.length > 0 && (
                    <button
                      onClick={() => setOpenRow(isOpen ? null : row.id)}
                      className="rounded-xl border border-ink-600 bg-ink-900 px-4 text-sm text-mist transition hover:border-splash"
                    >
                      {isOpen ? "اخفي المحلات" : "شوف المحلات"}
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-4 space-y-2 border-t border-ink-600 pt-3">
                    {row.shops.map((shop) => (
                      <div
                        key={`${shop.name}-${shop.signedUp}`}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-semibold text-paper">
                          {shop.name}
                        </span>

                        <span className="flex items-center gap-3 text-mist">
                          <span>{formatDate(shop.signedUp)}</span>

                          <span
                            className={
                              shop.settled
                                ? "text-green-400"
                                : shop.paid
                                ? "text-amber-300"
                                : "text-mist"
                            }
                          >
                            {shop.settled
                              ? "اتصرفت"
                              : shop.paid
                              ? `مستحق ${shop.amount} ج`
                              : "لسه ما دفعش"}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* ============================================================
          طلبات المجالات اللي لسه مابنخدمهاش
          ============================================================

          المسوّق بيسجّلها من شاشة العرض لما يقابل جيم أو عيادة
          (ميجريشن ٠٩٩). والعدد هنا هو اللي بيقرر نبني إيه بعد كده
          - **رقم من السوق، مش تخمين من على المكتب**. */}
      {byVertical.length > 0 && (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/10 p-5">
          <p className="mb-1 flex items-center gap-2 font-bold text-amber-200">
            <Clock size={16} />
            مجالات الناس بتطلبها
          </p>

          <p className="mb-4 text-xs text-mist">
            سجّلها المسوقين وهم برّه. المجال اللي رقمه بيكبر هو اللي
            يستاهل يتبني.
          </p>

          <div className="space-y-3">
            {byVertical.map((group) => (
              <details
                key={group.key}
                className="rounded-lg border border-ink-600 bg-ink-900"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between p-3">
                  <span className="font-semibold text-paper">
                    {group.label}
                  </span>

                  <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-ink-950">
                    {group.rows.length}
                  </span>
                </summary>

                <div className="space-y-2 border-t border-ink-600 p-3">
                  <p className="text-[11px] text-mist">
                    محتاج: {group.missing}
                  </p>

                  {group.rows.map((row) => (
                    <div key={row.id} className="text-xs">
                      <span className="font-semibold text-paper">
                        {row.shop_name}
                      </span>

                      {row.phone && (
                        <span dir="ltr" className="ms-2 text-mist">
                          {row.phone}
                        </span>
                      )}

                      <span className="ms-2 text-mist">
                        {formatDate(row.created_at)}
                      </span>

                      {row.note && (
                        <p className="mt-0.5 text-mist">{row.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
