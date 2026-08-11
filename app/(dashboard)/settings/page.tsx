"use client";

import { useEffect, useState } from "react";

import { changePassword } from "@/services/auth.service";
import { getBusiness, updateBusiness } from "@/repositories/business.repository";
import { useSession } from "@/hooks/useSession";
import type { FeatureKey } from "@/types/business";

const ADMIN_EMAIL = "basildraz@gmail.com";

const ALL_FEATURES: FeatureKey[] = [
  "pos_sales",
  "inventory",
  "categories",
  "shifts",
  "sales_reports",
  "multi_warehouse",
  "warehouse_reports",
  "discounts",
];

const FEATURE_LABELS: Record<FeatureKey, string> = {
  pos_sales: "نقطة البيع (بيع، مصروفات، سجل مبيعات)",
  inventory: "المخزون الأساسي والأصناف",
  categories: "الفئات وتصنيف الأصناف",
  shifts: "الشيفتات وإنهاء اليوم",
  sales_reports: "تقارير المبيعات والأرباح",
  multi_warehouse: "المخازن المتعددة والنقل بينها",
  warehouse_reports: "لوحة نبض المخازن",
  discounts: "الخصم على الفاتورة",
};

export default function SettingsPage() {
  const { user } = useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [maxDiscountPercent, setMaxDiscountPercent] = useState("");
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountSuccess, setDiscountSuccess] = useState(false);

  const [enabledFeatures, setEnabledFeatures] = useState<FeatureKey[] | null>(
    null
  );
  const [savingFeatures, setSavingFeatures] = useState(false);

  useEffect(() => {
    if (!user) return;

    getBusiness(user.business_id).then((business) => {
      if (business?.max_discount_percent != null) {
        setMaxDiscountPercent(String(business.max_discount_percent));
      }

      if (business?.enabled_features) {
        setEnabledFeatures(business.enabled_features);
      }
    });
  }, [user]);

  async function handleToggleFeature(feature: FeatureKey) {
    if (!user || !enabledFeatures) return;

    const newFeatures = enabledFeatures.includes(feature)
      ? enabledFeatures.filter((f) => f !== feature)
      : [...enabledFeatures, feature];

    setSavingFeatures(true);

    try {
      await updateBusiness(user.business_id, {
        enabled_features: newFeatures,
      });

      setEnabledFeatures(newFeatures);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء تحديث الميزة");
    } finally {
      setSavingFeatures(false);
    }
  }

  async function handleDiscountSubmit(e: React.FormEvent) {
    e.preventDefault();

    setDiscountSuccess(false);

    if (!user) return;

    const trimmed = maxDiscountPercent.trim();
    let value: number | null = null;

    if (trimmed !== "") {
      value = Number(trimmed);

      if (Number.isNaN(value) || value < 0 || value > 100) {
        alert("أقصى نسبة خصم لازم تكون رقم بين 0 و100");
        return;
      }
    }

    setDiscountSaving(true);

    try {
      await updateBusiness(user.business_id, { max_discount_percent: value });

      setDiscountSuccess(true);
    } catch (err) {
      console.error(JSON.stringify(err));
      alert("حدث خطأ أثناء حفظ نسبة الخصم");
    } finally {
      setDiscountSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSuccess(false);

    if (newPassword.length < 6) {
      alert("كلمة المرور لازم تكون 6 حروف أو أرقام على الأقل");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("كلمتا المرور غير متطابقتين");
      return;
    }

    setSaving(true);

    try {
      await changePassword(currentPassword, newPassword);

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء تغيير كلمة المرور";

      alert(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          ⚙️ الإعدادات
        </h1>

        <p className="mt-1 text-zinc-400">
          إدارة حسابك
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-bold">
          🏷️ الخصم على الفاتورة
        </h2>

        <form
          onSubmit={handleDiscountSubmit}
          className="space-y-4"
        >
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              أقصى نسبة خصم مسموحة على الفاتورة (اختياري)
            </label>

            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={maxDiscountPercent}
              onChange={(e) => setMaxDiscountPercent(e.target.value)}
              placeholder="اتركه فارغًا لتعطيل الخصم"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
            />
          </div>

          {discountSuccess && (
            <p className="text-sm text-green-400">
              ✅ تم حفظ نسبة الخصم بنجاح
            </p>
          )}

          <button
            type="submit"
            disabled={discountSaving}
            className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {discountSaving ? "جارِ الحفظ..." : "💾 حفظ نسبة الخصم"}
          </button>
        </form>
      </div>

      {user?.email === ADMIN_EMAIL && enabledFeatures && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/20 p-5">
          <h2 className="mb-4 text-lg font-bold">
            🔧 أدوات المطوّر — الميزات المفعّلة
          </h2>

          <div className="space-y-3">
            {ALL_FEATURES.map((feature) => (
              <label
                key={feature}
                className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950 p-3"
              >
                <input
                  type="checkbox"
                  checked={enabledFeatures.includes(feature)}
                  onChange={() => handleToggleFeature(feature)}
                  disabled={savingFeatures}
                  className="h-5 w-5"
                />

                <span className="text-sm">
                  {FEATURE_LABELS[feature]}
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={() => window.location.reload()}
            className="mt-4 w-full rounded-xl bg-amber-700 p-3 font-bold text-white hover:bg-amber-800"
          >
            🔄 تحديث الصفحة (بعد ما تخلّص التعديل)
          </button>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-bold">
          🔑 تغيير كلمة المرور
        </h2>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              كلمة المرور الحالية
            </label>

            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              كلمة المرور الجديدة
            </label>

            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
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
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none"
            />
          </div>

          {success && (
            <p className="text-sm text-green-400">
              ✅ تم تغيير كلمة المرور بنجاح
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "جارِ الحفظ..." : "💾 حفظ كلمة المرور الجديدة"}
          </button>
        </form>
      </div>
    </main>
  );
}
