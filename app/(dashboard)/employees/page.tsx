"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  AtSign,
  KeyRound,
  Power,
  Lock,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";
import {
  buildEmployeeEmail,
  normalizeUsername,
  normalizeBusinessCode,
  suggestBusinessCode,
} from "@/lib/employeeEmail";
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from "@/lib/pinRules";
import { getExampleHints } from "@/lib/examples";
import {
  requestNewEmployee,
  getMyBusinessRequests,
  cancelMyRequest,
  getMyEmployees,
  setEmployeeActive,
  setEmployeePin,
  setEmployeeRole,
  getPinStatus,
} from "@/services/employeeApprovalRequest.service";
import {
  PERMISSION_LABELS,
  PERMISSION_ORDER,
  ROLE_BASE_PERMISSIONS,
  STAFF_ROLES,
  STAFF_ROLE_DESCRIPTIONS,
  STAFF_ROLE_ICONS,
  STAFF_ROLE_LABELS,
  type PermissionKey,
  type StaffRole,
} from "@/lib/permissions";
import type { EmployeeApprovalRequest } from "@/types/employeeApprovalRequest";
import type { User } from "@/types/user";

const STATUS_LABELS: Record<
  EmployeeApprovalRequest["status"],
  { label: string; className: string; icon: typeof Clock }
> = {
  pending: {
    label: "بانتظار الموافقة",
    className: "border-amber-700 bg-amber-950/20 text-amber-400",
    icon: Clock,
  },
  approved: {
    label: "اتعمل الحساب",
    className: "border-green-700 bg-green-950/20 text-green-400",
    icon: CheckCircle2,
  },
  rejected: {
    label: "اترفض",
    className: "border-red-700 bg-red-950/20 text-red-400",
    icon: XCircle,
  },
  cancelled: {
    label: "اتلغى",
    className: "border-ink-600 bg-ink-800 text-mist",
    icon: Ban,
  },
};

// Three cards, and a short list of "and also..." ticks underneath.
// Deliberately not a grid of nine checkboxes: the owner is picking a
// job, not designing a permission matrix. Whatever the job already
// covers disappears from the list, so nothing is ever ticked twice.
function RolePicker({
  value,
  onChange,
  extras,
  onExtrasChange,
}: {
  value: StaffRole;
  onChange: (role: StaffRole) => void;
  extras: PermissionKey[];
  onExtrasChange: (permissions: PermissionKey[]) => void;
}) {
  const base = ROLE_BASE_PERMISSIONS[value];
  const optional = PERMISSION_ORDER.filter(
    (permission) => !base.includes(permission)
  );

  function toggle(permission: PermissionKey) {
    onExtrasChange(
      extras.includes(permission)
        ? extras.filter((p) => p !== permission)
        : [...extras, permission]
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {STAFF_ROLES.map((role) => {
          const active = role === value;

          return (
            <button
              key={role}
              type="button"
              onClick={() => onChange(role)}
              className={`rounded-xl border p-3 text-right transition ${
                active
                  ? "border-splash bg-splash/10"
                  : "border-ink-600 bg-ink-900 hover:border-ink-500"
              }`}
            >
              <p className="flex items-center gap-2 font-bold">
                <span className="text-xl">{STAFF_ROLE_ICONS[role]}</span>
                {STAFF_ROLE_LABELS[role]}
              </p>

              <p className="mt-1 text-xs leading-relaxed text-mist">
                {STAFF_ROLE_DESCRIPTIONS[role]}
              </p>
            </button>
          );
        })}
      </div>

      {optional.length > 0 && (
        <div className="rounded-xl border border-ink-600 bg-ink-900 p-3">
          <p className="mb-2 text-xs text-mist">
            وكمان تقدر تديله حاجة زيادة (اختياري):
          </p>

          <div className="flex flex-wrap gap-2">
            {optional.map((permission) => {
              const on = extras.includes(permission);

              return (
                <button
                  key={permission}
                  type="button"
                  onClick={() => toggle(permission)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    on
                      ? "border-splash bg-splash text-ink-950"
                      : "border-ink-600 text-mist hover:text-paper"
                  }`}
                >
                  {on ? "✓ " : "+ "}
                  {PERMISSION_LABELS[permission]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeesPage() {
  const { user, business } = useSession();
  const toast = useToast();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [newPin, setNewPin] = useState("");
  const [phone, setPhone] = useState("");
  const [businessCodeInput, setBusinessCodeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [requests, setRequests] = useState<EmployeeApprovalRequest[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [withPin, setWithPin] = useState<string[]>([]);
  const [lockedOut, setLockedOut] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [pinTarget, setPinTarget] = useState<User | null>(null);
  const [pinValue, setPinValue] = useState("");

  const [staffRole, setStaffRole] = useState<StaffRole>("cashier");
  const [extraPermissions, setExtraPermissions] = useState<PermissionKey[]>([]);

  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const [roleDraft, setRoleDraft] = useState<StaffRole>("cashier");
  const [extraDraft, setExtraDraft] = useState<PermissionKey[]>([]);

  useEffect(() => {
    if (user) load();
  }, [user]);

  // Prefill the code box with a guess the owner can overwrite. Only a
  // starting point - transliterating an Arabic shop name rarely lands
  // on something anyone would want to type.
  useEffect(() => {
    if (business && !business.employee_email_code && !businessCodeInput) {
      setBusinessCodeInput(suggestBusinessCode(business.name));
    }
  }, [business]);

  async function load() {
    if (!user) return;

    setLoading(true);

    const [requestsData, employeesData, pinStatus] = await Promise.all([
      getMyBusinessRequests(user.business_id),
      getMyEmployees(user.business_id),
      getPinStatus(),
    ]);

    setRequests(requestsData);
    setEmployees(employeesData);
    setWithPin(pinStatus.withPin);
    setLockedOut(pinStatus.lockedOut);
    setLoading(false);
  }

  // Set once, with the first employee, then frozen server-side - so the
  // input only appears while it's still unset.
  const savedBusinessCode = business?.employee_email_code ?? null;
  const isCodeLocked = Boolean(savedBusinessCode);

  const businessCode =
    savedBusinessCode ?? normalizeBusinessCode(businessCodeInput);

  // Placeholders that match the kind of shop this actually is - a
  // coffee roastery shouldn't be shown supermarket examples.
  const hints = getExampleHints(business);

  const cleanUsername = normalizeUsername(username);

  const emailPreview =
    cleanUsername && businessCode
      ? buildEmployeeEmail(cleanUsername, businessCode)
      : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    if (!fullName.trim()) {
      toast.error("اسم الموظف مطلوب");
      return;
    }

    setSubmitting(true);

    try {
      await requestNewEmployee({
        fullName: fullName.trim(),
        username,
        pin: newPin,
        phone: phone.trim() || undefined,
        businessCode: isCodeLocked ? undefined : businessCodeInput,
        staffRole,
        extraPermissions,
      });

      toast.success("اتبعت الطلب - الحساب هيشتغل بالرقم السري ده أول ما يتوافق عليه");
      setFullName("");
      setUsername("");
      setNewPin("");
      setPhone("");
      setStaffRole("cashier");
      setExtraPermissions([]);
      await load();
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : "حدث خطأ أثناء إرسال الطلب";

      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(requestId: string) {
    try {
      await cancelMyRequest(requestId);
      toast.success("اتلغى الطلب");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("تعذر إلغاء الطلب");
    }
  }

  async function handleToggleActive(employee: User) {
    setBusyId(employee.id);

    try {
      await setEmployeeActive(employee.id, !employee.active);

      toast.success(
        employee.active
          ? `اتوقف حساب ${employee.full_name}`
          : `اتفعّل حساب ${employee.full_name}`
      );

      await load();
    } catch (err) {
      console.error(err);
      toast.error("تعذر تغيير حالة الحساب");
    } finally {
      setBusyId(null);
    }
  }

  function openRoleEditor(employee: User) {
    setRoleTarget(employee);
    setRoleDraft((employee.staff_role ?? "cashier") as StaffRole);
    setExtraDraft((employee.extra_permissions ?? []) as PermissionKey[]);
  }

  async function handleSaveRole() {
    if (!roleTarget) return;

    setBusyId(roleTarget.id);

    try {
      // Anything the chosen role already includes is dropped: keeping
      // it would show a cashier's "يبيع" tick as if it were an extra
      // the owner had granted, and it would come back as noise the
      // next time the role changed.
      const base = ROLE_BASE_PERMISSIONS[roleDraft];
      const extras = extraDraft.filter((p) => !base.includes(p));

      await setEmployeeRole(roleTarget.id, roleDraft, extras);

      toast.success(`${roleTarget.full_name} بقى ${STAFF_ROLE_LABELS[roleDraft]}`);
      setRoleTarget(null);
      await load();
    } catch (err) {
      console.error(err);
      toast.error("تعذر تغيير الصلاحيات");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSavePin(e: React.FormEvent) {
    e.preventDefault();

    if (!pinTarget) return;

    setBusyId(pinTarget.id);

    try {
      await setEmployeePin(pinTarget.id, pinValue);

      toast.success(`اتحدد الرقم السري لـ ${pinTarget.full_name}`);

      setPinTarget(null);
      setPinValue("");
      await load();
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : "تعذر حفظ الرقم السري";

      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <UserPlus size={28} />
          الموظفين
        </h1>

        <p className="mt-1 text-mist">
          حسابات الكاشيرين بتاعتك - إنت اللي بتفتحها وتقفلها وتحدد رقمها السري
        </p>
      </div>

      {pinTarget && (
        <div className="rounded-xl border border-splash bg-splash/10 p-5">
          <h2 className="mb-1 flex items-center gap-2 font-bold text-splash">
            <KeyRound size={18} />
            الرقم السري لـ {pinTarget.full_name}
          </h2>

          <p className="mb-4 text-xs text-mist">
            من {PIN_MIN_LENGTH} لـ {PIN_MAX_LENGTH} أرقام. ده اللي الكاشير
            هيدوسه على الشاشة عشان يدخل - اتفق معاه عليه.
          </p>

          <form onSubmit={handleSavePin} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              value={pinValue}
              onChange={(e) =>
                setPinValue(
                  e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH)
                )
              }
              placeholder="٤ أرقام"
              autoFocus
              dir="ltr"
              className="w-full rounded-xl border border-ink-600 bg-ink-900 p-4 text-center font-mono text-3xl tracking-[0.5em] text-paper outline-none focus:border-splash"
            />

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={
                  busyId === pinTarget.id || pinValue.length < PIN_MIN_LENGTH
                }
                className="flex-1 rounded-xl bg-splash p-3 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50"
              >
                حفظ
              </button>

              <button
                type="button"
                onClick={() => {
                  setPinTarget(null);
                  setPinValue("");
                }}
                className="rounded-xl border border-ink-600 px-5 text-mist hover:text-paper"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-4 text-lg font-bold">
          طلب موظف جديد
        </h2>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {!isCodeLocked && (
            <div className="rounded-lg border border-amber-800 bg-amber-950/20 p-4">
              <label className="mb-2 block text-sm font-bold text-amber-400">
                كود المحل بالإنجليزي
              </label>

              <input
                type="text"
                value={businessCodeInput}
                onChange={(e) => setBusinessCodeInput(e.target.value)}
                placeholder={hints.shopCode}
                dir="ltr"
                required
                className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-left font-mono text-paper outline-none focus:border-splash"
              />

              <p className="mt-2 text-xs text-mist">
                ده بيتكتب مرة واحدة بس وبعد كده مينفعش يتغير - اختار حاجة قصيرة
                تعبّر عن محلك بالإنجليزي. الكاشير هيكتبه أول مرة يدخل بس.
              </p>
            </div>
          )}

          {isCodeLocked && (
            <p className="text-xs text-mist">
              كود محلك:{" "}
              <span dir="ltr" className="font-mono text-splash">
                {savedBusinessCode}
              </span>
            </p>
          )}

          <div>
            <label className="mb-2 block text-sm text-mist">
              اسم الموظف
            </label>

            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={`مثال: ${hints.employeeFullName}`}
              required
              className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-paper outline-none focus:border-splash"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-mist">
              اسم الدخول بالإنجليزي
            </label>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={hints.employeeUsername}
              dir="ltr"
              required
              className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-left text-paper outline-none focus:border-splash"
            />

            <p className="mt-1 text-xs text-mist">
              حروف إنجليزي وأرقام بس - الكاشير مش هيحتاج يكتبه، بس لازم يبقى
              مختلف عن باقي الموظفين
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm text-mist">
              الرقم السري للكاشير
            </label>

            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              value={newPin}
              onChange={(e) =>
                setNewPin(
                  e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH)
                )
              }
              placeholder="١٣٧٩"
              dir="ltr"
              required
              className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-paper outline-none focus:border-splash"
            />

            <p className="mt-1 text-xs text-mist">
              من {PIN_MIN_LENGTH} لـ {PIN_MAX_LENGTH} أرقام - ده اللي الكاشير
              هيدوسه عشان يدخل. اتفق معاه عليه واقدر تغيّره في أي وقت.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm text-mist">
              الموظف ده هيعمل إيه؟
            </label>

            <RolePicker
              value={staffRole}
              onChange={setStaffRole}
              extras={extraPermissions}
              onExtrasChange={setExtraPermissions}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-mist">
              رقم التليفون (اختياري)
            </label>

            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-paper outline-none focus:border-splash"
            />
          </div>

          {emailPreview && (
            <p className="flex items-center gap-2 text-sm text-mist">
              <AtSign size={14} />
              حساب الدخول:{" "}
              <span dir="ltr" className="font-mono text-splash">
                {emailPreview}
              </span>
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-splash p-3 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50"
          >
            {submitting ? "جارِ الإرسال..." : "ابعت الطلب"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">
          الموظفين الشغالين
        </h2>

        {loading ? (
          <div className="p-8 text-center text-mist">
            جارِ التحميل...
          </div>
        ) : employees.length === 0 ? (
          <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
            لسه مفيش موظفين
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map((employee) => {
              const hasPin = withPin.includes(employee.id);
              const isLocked = lockedOut.includes(employee.id);

              const role = (employee.staff_role ?? "cashier") as StaffRole;
              const editing = roleTarget?.id === employee.id;

              return (
                <div
                  key={employee.id}
                  className={`rounded-xl border p-4 ${
                    hasPin
                      ? "border-ink-600 bg-ink-800"
                      : "border-amber-800 bg-amber-950/20"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-paper">
                        {employee.full_name}
                      </span>

                      <span className="rounded-full border border-ink-600 bg-ink-900 px-2 py-0.5 text-xs text-mist">
                        {STAFF_ROLE_ICONS[role]} {STAFF_ROLE_LABELS[role]}
                      </span>

                      {!employee.active && (
                        <span className="rounded-full border border-red-700 bg-red-950/20 px-2 py-0.5 text-xs text-red-400">
                          متوقف
                        </span>
                      )}

                      {!hasPin && (
                        <span className="flex items-center gap-1 rounded-full border border-amber-700 px-2 py-0.5 text-xs text-amber-400">
                          <AlertTriangle size={11} />
                          لسه مش قادر يدخل - حدّد رقم سري
                        </span>
                      )}

                      {isLocked && (
                        <span className="flex items-center gap-1 rounded-full border border-red-700 bg-red-950/20 px-2 py-0.5 text-xs text-red-400">
                          <Lock size={11} />
                          متقفل مؤقتًا (غلط في الرقم كتير)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        editing ? setRoleTarget(null) : openRoleEditor(employee)
                      }
                      disabled={busyId === employee.id}
                      className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-sm text-mist hover:text-paper disabled:opacity-50"
                    >
                      <ShieldCheck size={14} />
                      {editing ? "إلغاء" : "غيّر شغلانته"}
                    </button>

                    <button
                      onClick={() => {
                        setPinTarget(employee);
                        setPinValue("");
                      }}
                      disabled={busyId === employee.id}
                      className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-sm text-mist hover:text-paper disabled:opacity-50"
                    >
                      <KeyRound size={14} />
                      {hasPin ? "غيّر الرقم السري" : "حدّد رقم سري"}
                    </button>

                    <button
                      onClick={() => handleToggleActive(employee)}
                      disabled={busyId === employee.id}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50 ${
                        employee.active
                          ? "bg-red-800/80 text-white hover:bg-red-800"
                          : "bg-green-700 text-white hover:bg-green-800"
                      }`}
                    >
                      <Power size={14} />
                      {employee.active ? "إيقاف" : "تفعيل"}
                    </button>
                  </div>
                  </div>

                  {editing && (
                    <div className="mt-4 border-t border-ink-600 pt-4">
                      <RolePicker
                        value={roleDraft}
                        onChange={setRoleDraft}
                        extras={extraDraft}
                        onExtrasChange={setExtraDraft}
                      />

                      <button
                        onClick={handleSaveRole}
                        disabled={busyId === employee.id}
                        className="mt-3 w-full rounded-xl bg-splash p-3 font-bold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
                      >
                        احفظ
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">
          الطلبات
        </h2>

        {loading ? (
          <div className="p-8 text-center text-mist">
            جارِ التحميل...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
            لسه مفيش طلبات
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const status = STATUS_LABELS[req.status];
              const StatusIcon = status.icon;

              return (
                <div
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-800 p-4"
                >
                  <div>
                    <div className="font-bold text-paper">
                      {req.full_name}
                    </div>

                    <div dir="ltr" className="mt-1 text-right font-mono text-xs text-mist">
                      {req.generated_email}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${status.className}`}
                    >
                      <StatusIcon size={14} />
                      {status.label}
                    </span>

                    {req.status === "pending" && (
                      <button
                        onClick={() => handleCancel(req.id)}
                        className="text-xs text-mist hover:text-red-400"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
