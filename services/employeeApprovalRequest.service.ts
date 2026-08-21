import {
  getRequestsForBusiness,
  cancelOwnRequest,
  getPendingRequests,
} from "@/repositories/employeeApprovalRequest.repository";
import {
  getEmployees,
  setUserActive,
  setUserRole,
} from "@/repositories/user.repository";
import { supabase } from "@/lib/supabase";

import type { EmployeeApprovalRequest } from "@/types/employeeApprovalRequest";
import type { PermissionKey, StaffRole } from "@/lib/permissions";
import type { User } from "@/types/user";

async function getAccessTokenOrThrow(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("لازم تسجّل الدخول الأول");
  }

  return session.access_token;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const accessToken = await getAccessTokenOrThrow();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "حصل خطأ");
  }

  return data as T;
}

// Goes through an API route rather than a direct insert because the
// PIN has to be hashed server-side - the browser must never be the
// last place a plaintext PIN existed. The route re-checks that the
// caller is an active owner; the RLS policy that used to guard the
// direct insert still exists as the second line of defence.
export async function requestNewEmployee(params: {
  fullName: string;
  username: string;
  pin: string;
  phone?: string;
  businessCode?: string;

  // What this person will be allowed to do once the account exists.
  // Decided here rather than after approval so the owner answers the
  // question while they are still thinking about the person.
  staffRole?: StaffRole;
  extraPermissions?: PermissionKey[];
}): Promise<{ id: string; email: string; businessCode: string }> {
  return postJson("/api/employees/request", params);
}

export async function getMyBusinessRequests(
  businessId: string
): Promise<EmployeeApprovalRequest[]> {
  return getRequestsForBusiness(businessId);
}

export async function cancelMyRequest(requestId: string): Promise<void> {
  await cancelOwnRequest(requestId);
}

// ==========================================
// Owner-managed employee accounts
// ==========================================

export async function getMyEmployees(businessId: string): Promise<User[]> {
  return getEmployees(businessId);
}

// Takes effect on the cashier's next login attempt - pin-login checks
// `active` server-side before minting a session.
export async function setEmployeeActive(
  userId: string,
  active: boolean
): Promise<void> {
  await setUserActive(userId, active);
}

// Written straight to the table: the users_owner_update policy
// (migration 034) already limits this to an owner inside their own
// business, and protect_user_identity_columns (migration 047) raises
// if anyone else tries to move these two columns through the same
// path.
export async function setEmployeeRole(
  userId: string,
  staffRole: StaffRole,
  extraPermissions: PermissionKey[]
): Promise<void> {
  await setUserRole(userId, staffRole, extraPermissions);
}

// Also clears any lockout, so "الكاشير اتقفل" is fixed by the same
// button that changes the PIN.
export async function setEmployeePin(
  employeeId: string,
  pin: string
): Promise<void> {
  await postJson("/api/employees/set-pin", { employeeId, pin });
}

export async function getPinStatus(): Promise<{
  withPin: string[];
  lockedOut: string[];
}> {
  const accessToken = await getAccessTokenOrThrow();

  const res = await fetch("/api/employees/pin-status", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return { withPin: [], lockedOut: [] };
  }

  return res.json();
}

// ==========================================
// Master-only actions below. RLS has no update policy for platform
// admins on employee_approval_requests at all (see migration 032) -
// these MUST go through the API routes (service role, server-side
// re-check of is_platform_admin()), never a direct table write.
// ==========================================

export async function getAllPendingRequests() {
  return getPendingRequests();
}

export async function approveEmployeeRequest(
  requestId: string
): Promise<{ userId: string; email: string; fullName: string }> {
  return postJson("/api/employees/approve", { requestId });
}

export async function rejectEmployeeRequest(
  requestId: string,
  reason?: string
): Promise<void> {
  await postJson("/api/employees/reject", { requestId, reason });
}
