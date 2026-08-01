"use client";

import { useState } from "react";

import { changePassword } from "@/services/auth.service";

export default function SettingsPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

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
      await changePassword(newPassword);

      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء تغيير كلمة المرور");
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
          🔑 تغيير كلمة المرور
        </h2>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
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
