"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserCog, ArrowRight, Delete, Store } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { logActivity } from "@/repositories/activity.repository";
import { getUserByAuthId } from "@/repositories/user.repository";
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from "@/lib/pinRules";

type StaffMember = { id: string; full_name: string };

// The till is usually the same device every day, so remembering the
// shop code turns a 3-step login into a 2-tap one.
const SHOP_CODE_STORAGE_KEY = "octopus_shop_code";

export default function EmployeeLoginPage() {
  const router = useRouter();

  const [shopCode, setShopCode] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(SHOP_CODE_STORAGE_KEY);

    if (saved) {
      setShopCode(saved);
      void loadStaff(saved);
    }
  }, []);

  async function loadStaff(code: string) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/shop-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopCode: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "مفيش محل بالكود ده");
        setStaff(null);
        return;
      }

      window.localStorage.setItem(SHOP_CODE_STORAGE_KEY, code);

      setBusinessName(data.businessName);
      setStaff(data.staff);
    } catch {
      setError("تعذر الاتصال - اتأكد من الإنترنت");
    } finally {
      setLoading(false);
    }
  }

  async function submitPin(finalPin: string) {
    if (!selected) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selected.id, pin: finalPin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "الرقم السري غلط");
        setPin("");
        return;
      }

      // Exchange the one-time token minted server-side for a real
      // session in this browser.
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: "magiclink",
      });

      if (otpError) {
        console.error(otpError);
        setError("تعذر فتح الجلسة - جرّب تاني");
        setPin("");
        return;
      }

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const appUser = await getUserByAuthId(authUser.id);

        if (appUser) {
          await logActivity(appUser.id, appUser.business_id);
        }
      }

      router.push("/sales");
    } catch {
      setError("تعذر الاتصال - اتأكد من الإنترنت");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  function pressDigit(digit: string) {
    if (pin.length >= PIN_MAX_LENGTH || loading) return;

    const next = pin + digit;

    setPin(next);
    setError("");

    // 4 digits is the common case - log in without making the cashier
    // hunt for a confirm button. Longer PINs use the ✓ key.
    if (next.length === PIN_MIN_LENGTH) {
      void submitPin(next);
    }
  }

  function resetToStaffList() {
    setSelected(null);
    setPin("");
    setError("");
  }

  function changeShop() {
    window.localStorage.removeItem(SHOP_CODE_STORAGE_KEY);
    setStaff(null);
    setSelected(null);
    setPin("");
    setShopCode("");
    setError("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-ink-600 bg-ink-800 p-8 shadow-2xl">

        <div className="mb-8 text-center">
          <h1 className="flex items-center justify-center gap-2 text-3xl font-bold">
            <UserCog size={30} />
            دخول الكاشير
          </h1>

          {businessName && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-mist">
              <Store size={14} />
              {businessName}
            </p>
          )}
        </div>

        {/* Step 1 - which shop */}
        {!staff && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadStaff(shopCode);
            }}
            className="space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm text-mist">
                كود المحل
              </label>

              <input
                type="text"
                value={shopCode}
                onChange={(e) => setShopCode(e.target.value)}
                placeholder="كود المحل"
                dir="ltr"
                required
                autoFocus
                className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-4 text-center font-mono text-2xl text-paper outline-none focus:border-splash"
              />

              <p className="mt-2 text-xs text-mist">
                صاحب النشاط هو اللي يقولك عليه - هيتحفظ على الجهاز ده
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-splash py-4 text-lg font-bold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
            >
              {loading ? "لحظة..." : "التالي"}
            </button>
          </form>
        )}

        {/* Step 2 - who are you */}
        {staff && !selected && (
          <div className="space-y-3">
            <p className="mb-4 text-center text-mist">
              دوس على اسمك
            </p>

            {staff.length === 0 ? (
              <p className="rounded-xl border border-ink-600 bg-ink-900 p-6 text-center text-mist">
                مفيش موظفين مفعّلين في المحل ده
              </p>
            ) : (
              staff.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelected(member)}
                  className="w-full rounded-xl border border-ink-600 bg-ink-900 p-5 text-lg font-bold text-paper transition hover:border-splash hover:bg-ink-700"
                >
                  {member.full_name}
                </button>
              ))
            )}

            {error && (
              <p className="text-center text-sm text-red-500">{error}</p>
            )}

            <button
              onClick={changeShop}
              className="w-full pt-2 text-center text-sm text-mist hover:text-paper"
            >
              محل تاني
            </button>
          </div>
        )}

        {/* Step 3 - the PIN pad */}
        {selected && (
          <div className="space-y-6">
            <p className="text-center text-lg font-bold text-paper">
              {selected.full_name}
            </p>

            <div className="flex justify-center gap-3">
              {Array.from({ length: PIN_MAX_LENGTH }).map((_, index) => (
                <span
                  key={index}
                  className={`h-4 w-4 rounded-full border transition ${
                    index < pin.length
                      ? "border-splash bg-splash"
                      : index < PIN_MIN_LENGTH
                      ? "border-ink-600 bg-ink-900"
                      : "border-ink-700 bg-transparent"
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-center text-sm text-red-500">{error}</p>
            )}

            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button
                  key={digit}
                  onClick={() => pressDigit(digit)}
                  disabled={loading}
                  className="rounded-xl bg-ink-900 py-5 text-2xl font-bold text-paper transition hover:bg-ink-700 disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}

              <button
                onClick={() => setPin(pin.slice(0, -1))}
                disabled={loading}
                className="flex items-center justify-center rounded-xl bg-ink-900 py-5 text-mist transition hover:bg-ink-700 disabled:opacity-50"
              >
                <Delete size={22} />
              </button>

              <button
                onClick={() => pressDigit("0")}
                disabled={loading}
                className="rounded-xl bg-ink-900 py-5 text-2xl font-bold text-paper transition hover:bg-ink-700 disabled:opacity-50"
              >
                0
              </button>

              <button
                onClick={() => void submitPin(pin)}
                disabled={loading || pin.length < PIN_MIN_LENGTH}
                className="rounded-xl bg-splash py-5 text-2xl font-bold text-ink-950 transition hover:bg-splash-deep disabled:opacity-40"
              >
                ✓
              </button>
            </div>

            <button
              onClick={resetToStaffList}
              className="w-full text-center text-sm text-mist hover:text-paper"
            >
              مش أنا
            </button>
          </div>
        )}

        <div className="mt-8 flex justify-center text-sm">
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
