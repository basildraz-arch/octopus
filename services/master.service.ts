import { supabase } from "@/lib/supabase";
import type { MasterBusinessRow } from "@/app/api/master/overview/route";

export type PlatformAdminAction = {
  id: string;
  business_name: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

async function getAccessTokenOrThrow(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("لازم تسجّل الدخول الأول");

  return session.access_token;
}

export async function getMasterOverview(): Promise<{
  windowDays: number;
  businesses: MasterBusinessRow[];
}> {
  const accessToken = await getAccessTokenOrThrow();

  const res = await fetch("/api/master/overview", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data?.error || "تعذر تحميل البيانات");

  return data;
}

// Every one of these is recorded in platform_admin_actions before it
// takes effect - see the API route.
export async function runMasterAction(
  body:
    | { businessId: string; action: "set_active"; active: boolean }
    | { businessId: string; action: "extend_subscription"; months: number }
    | { businessId: string; action: "set_features"; features: string[] }
    | {
        businessId: string;
        action: "set_business_type";
        businessType: string;
      }
    | {
        businessId: string;
        action: "set_labels";
        labels: Record<string, string>;
      }
    | {
        businessId: string;
        action: "apply_template";
        businessType: string;
      }
    | {
        businessId: string;
        action: "set_limits";
        staffLimit?: number;
        warehouseLimit?: number;
        branchLimit?: number;
        monthlyPrice?: number | null;
      }
    | {
        businessId: string;
        action: "save_as_template";
        businessType: string;
        label: string;
        icon?: string;
        description?: string;
      }
): Promise<void> {
  const accessToken = await getAccessTokenOrThrow();

  const res = await fetch("/api/master/business", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data?.error || "تعذر تنفيذ الإجراء");
}

// Approving is what actually applies a business owner's requested
// change - the database refuses those writes to anyone not holding
// the service role (migration 049), and this route is the only place
// that role is reachable.
export async function reviewChangeRequest(body: {
  requestId: string;
  action: "approve" | "reject";
  reviewNote?: string;
}): Promise<void> {
  const accessToken = await getAccessTokenOrThrow();

  const res = await fetch("/api/master/change-request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data?.error || "تعذر تنفيذ الإجراء");
}

// Read straight from the table: RLS already limits this to platform
// admins (migration 043), so no API route is needed for a plain read.
export async function getRecentMasterActions(
  limit = 30
): Promise<PlatformAdminAction[]> {
  const { data, error } = await supabase
    .from("platform_admin_actions")
    .select("id, business_name, action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as PlatformAdminAction[];
}

// Referral codes and payouts. Same shape as runMasterAction: the API
// route re-checks is_platform_admin() before touching anything, and
// the tables refuse every client write outright (migration 058).
export async function runReferralAction(
  body:
    | {
        action: "create_code";
        code: string;
        kind: "customer" | "marketer";
        holderName: string;
        holderPhone?: string;
        businessId?: string;
        monthlyReward?: number;
        rewardMonths?: number;
        notes?: string;
      }
    | { action: "set_code_active"; codeId: string; active: boolean }
    | {
        action: "record_payout";
        codeId: string;
        amount: number;
        periodLabel?: string;
        note?: string;
      }
): Promise<void> {
  const accessToken = await getAccessTokenOrThrow();

  const res = await fetch("/api/master/referral", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data?.error || "تعذر تنفيذ الإجراء");
}

// ============================================================
// المسوقين
// ============================================================
//
// كلهم بيمرّوا على `/api/master/marketer` اللي بيتأكد من هوية
// الأدمن على السيرفر بـ`is_platform_admin()` - نفس الدالة اللي
// الـRLS نفسها بتناديها. الشاشة مابتقررش حاجة.

export type MarketerShop = {
  name: string;
  signedUp: string;
  paid: boolean;
  settled: boolean;
  amount: number;
};

export type MarketerRow = {
  id: string;
  fullName: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
  code: string;
  codeActive: boolean;
  rewardEach: number;
  signedUpCount: number;
  paidCount: number;
  due: number;
  settled: number;
  shops: MarketerShop[];
};

export async function getMarketers(): Promise<MarketerRow[]> {
  const accessToken = await getAccessTokenOrThrow();

  const res = await fetch("/api/master/marketer", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data?.error || "تعذر تحميل المسوقين");

  return data.marketers as MarketerRow[];
}

export async function runMarketerAction(
  body:
    | {
        action: "create";
        fullName: string;
        email: string;
        password: string;
        code: string;
        phone?: string;
        signupReward: number;
        notes?: string;
      }
    | { action: "set_active"; marketerId: string; active: boolean }
    | { action: "set_reward"; marketerId: string; signupReward: number }
    | { action: "settle"; marketerId: string; note?: string }
): Promise<{ ok: true; amount?: number; code?: string; email?: string }> {
  const accessToken = await getAccessTokenOrThrow();

  const res = await fetch("/api/master/marketer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data?.error || "تعذر تنفيذ العملية");

  return data;
}
