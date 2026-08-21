"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Check, X, CheckCircle2 } from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";
import {
  getAllPendingRequests,
  approveEmployeeRequest,
  rejectEmployeeRequest,
} from "@/services/employeeApprovalRequest.service";
import {
  PERMISSION_LABELS,
  STAFF_ROLE_ICONS,
  STAFF_ROLE_LABELS,
  type PermissionKey,
  type StaffRole,
} from "@/lib/permissions";
import type { EmployeeApprovalRequest } from "@/types/employeeApprovalRequest";

type PendingRow = EmployeeApprovalRequest & {
  businesses: { name: string } | null;
};

type ApprovedAccount = {
  fullName: string;
  email: string;
};

export default function EmployeeRequestsPage() {
  const router = useRouter();
  const { isPlatformAdmin, loading: sessionLoading } = useSession();
  const toast = useToast();

  const [requests, setRequests] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approved, setApproved] = useState<ApprovedAccount | null>(null);

  // This is a UI convenience redirect only - is_platform_admin() is
  // re-checked server-side by every /api/employees/* call regardless
  // of what this page does or doesn't render.
  useEffect(() => {
    if (!sessionLoading && !isPlatformAdmin) {
      router.replace("/dashboard");
    }
  }, [sessionLoading, isPlatformAdmin, router]);

  useEffect(() => {
    if (isPlatformAdmin) load();
  }, [isPlatformAdmin]);

  async function load() {
    setLoading(true);
    const data = await getAllPendingRequests();
    setRequests(data as PendingRow[]);
    setLoading(false);
  }

  async function handleApprove(requestId: string) {
    setBusyId(requestId);

    try {
      const result = await approveEmployeeRequest(requestId);

      setApproved({
        fullName: result.fullName,
        email: result.email,
      });

      await load();
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : "تعذرت الموافقة على الطلب";

      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(requestId: string) {
    setBusyId(requestId);

    try {
      await rejectEmployeeRequest(requestId);
      toast.success("اترفض الطلب");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("تعذر رفض الطلب");
    } finally {
      setBusyId(null);
    }
  }

  if (sessionLoading || !isPlatformAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-mist">
        جارِ التحميل...
      </div>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <ShieldCheck size={28} />
          طلبات الموظفين
        </h1>

        <p className="mt-1 text-mist">
          صفحة Master - طلبات إضافة موظفين من كل الأنشطة، بانتظار موافقتك
        </p>
      </div>

      {approved && (
        <div className="rounded-xl border border-green-700 bg-green-950/20 p-5">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-green-400">
            <CheckCircle2 size={18} />
            اتعمل حساب {approved.fullName}
          </h2>

          <p className="text-sm text-mist">
            صاحب النشاط هو اللي يحدد الرقم السري للكاشير من صفحة الموظفين
            عنده - مفيش أي كلمة سر بتعدّي من هنا.
          </p>

          <button
            onClick={() => setApproved(null)}
            className="mt-3 rounded-lg border border-ink-600 px-4 py-2 text-sm text-mist hover:text-paper"
          >
            تمام
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-mist">
          جارِ التحميل...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-8 text-center text-mist">
          مفيش طلبات معلّقة دلوقتي
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-ink-600 bg-ink-800 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-paper">
                      {req.full_name}
                    </span>

                    {/* What the owner is actually asking for. Approving
                        grants exactly this, so it belongs on the card
                        and not one click away. */}
                    <span className="rounded-full border border-ink-600 bg-ink-900 px-2 py-0.5 text-xs text-mist">
                      {STAFF_ROLE_ICONS[(req.staff_role ?? "cashier") as StaffRole]}{" "}
                      {STAFF_ROLE_LABELS[(req.staff_role ?? "cashier") as StaffRole]}
                    </span>

                    {(req.extra_permissions ?? []).map((permission) => (
                      <span
                        key={permission}
                        className="rounded-full border border-splash/40 bg-splash/10 px-2 py-0.5 text-xs text-splash"
                      >
                        + {PERMISSION_LABELS[permission as PermissionKey] ?? permission}
                      </span>
                    ))}
                  </div>

                  <div className="mt-1 text-sm text-mist">
                    {req.businesses?.name ?? "بيزنس محذوف"}
                  </div>

                  <div className="mt-1 text-xs text-mist">
                    {req.generated_email}
                    {req.phone ? ` · ${req.phone}` : ""}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={busyId === req.id}
                    className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-50"
                  >
                    <Check size={14} />
                    موافقة
                  </button>

                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={busyId === req.id}
                    className="flex items-center gap-1.5 rounded-lg bg-red-800/80 px-3 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
                  >
                    <X size={14} />
                    رفض
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
