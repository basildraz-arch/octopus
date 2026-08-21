import { supabase } from "@/lib/supabase";
import type { EmployeeApprovalRequest } from "@/types/employeeApprovalRequest";

// Postgres unique_violation. The generated_email unique constraint on
// employee_approval_requests is the real arbiter of "is this login
// taken" - an owner can only SEE their own business's rows under RLS,
// so a client-side pre-check could never be trusted.
export const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

export async function createApprovalRequest(params: {
  businessId: string;
  requestedBy: string;
  fullName: string;
  phone?: string;
  branchId?: string;
  generatedEmail: string;
}): Promise<EmployeeApprovalRequest> {
  const { data, error } = await supabase
    .from("employee_approval_requests")
    .insert({
      business_id: params.businessId,
      requested_by: params.requestedBy,
      full_name: params.fullName,
      phone: params.phone ?? null,
      branch_id: params.branchId ?? null,
      generated_email: params.generatedEmail,
    })
    .select()
    .single();

  if (error) throw error;

  return data as EmployeeApprovalRequest;
}

export async function getRequestsForBusiness(
  businessId: string
): Promise<EmployeeApprovalRequest[]> {
  const { data, error } = await supabase
    .from("employee_approval_requests")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return data as EmployeeApprovalRequest[];
}

// For the Master queue - relies on RLS (platform_admin read policy)
// to scope this to every business at once; a non-master caller
// will just get their own business's pending rows back, never an
// error, since the policy is additive with the owner's own read
// access.
export async function getPendingRequests(): Promise<
  (EmployeeApprovalRequest & { businesses: { name: string } | null })[]
> {
  const { data, error } = await supabase
    .from("employee_approval_requests")
    .select("*, businesses ( name )")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return data as (EmployeeApprovalRequest & {
    businesses: { name: string } | null;
  })[];
}

// Owner-only, and only while still pending - enforced again by RLS
// (owner_cancel_own_pending in migration 032), this isn't just a
// client-side convenience check.
export async function cancelOwnRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from("employee_approval_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);

  if (error) throw error;
}
