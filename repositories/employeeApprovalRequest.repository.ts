import { supabase } from "@/lib/supabase";
import type { EmployeeApprovalRequest } from "@/types/employeeApprovalRequest";

// Postgres unique_violation. The generated_email unique constraint on
// employee_approval_requests is the real arbiter of "is this login
// taken" - an owner can only SEE their own business's rows under RLS,
// so a client-side pre-check could never be trusted.
// كل أعمدة الجدول ما عدا pin_hash.
//
// العمود ده ممنوع على مستوى قاعدة البيانات (ميجريشن 080) - تجزئة
// رقم سري من ٤ أرقام بتتكسر في ثواني لو حد قراها. و`select("*")`
// بيطلبه فبيرفض الاستعلام كله، زي ما حصل بالظبط مع items.buy_price.
//
// لازم تفضل نص ثابت مكتوب كده مش مصفوفة مع join - Supabase بيقرا
// أسماء الأعمدة من النص نفسه وقت فحص الأنواع.
//
// أي عمود جديد في الجدول لازم يتضاف هنا كمان.
const REQUEST_COLUMNS =
  "id, business_id, requested_by, full_name, phone, branch_id, generated_email, status, reviewed_by, reviewed_at, rejection_reason, created_user_id, created_at, updated_at, staff_role, extra_permissions";

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
    .select(REQUEST_COLUMNS)
    .single();

  if (error) throw error;

  return data as EmployeeApprovalRequest;
}

export async function getRequestsForBusiness(
  businessId: string
): Promise<EmployeeApprovalRequest[]> {
  const { data, error } = await supabase
    .from("employee_approval_requests")
    .select(REQUEST_COLUMNS)
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
    .select(
      // نص كامل مكتوب بالإيد مش قالب نصي: Supabase بيستنتج شكل
      // الصف الراجع من **النص الحرفي**. أي تركيب (join أو قالب)
      // بيطلّع string عادي فالنوع الراجع بيبقى مجهول والـbuild
      // بيقع. حصل قبل كده مع ITEM_COLUMNS.
      "id, business_id, requested_by, full_name, phone, branch_id, generated_email, status, reviewed_by, reviewed_at, rejection_reason, created_user_id, created_at, updated_at, staff_role, extra_permissions, businesses ( name )"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  // Supabase بيرجّع businesses كمصفوفة (join) فالـcast المباشر بيقع
  // في التايب تشيك - بنعدّي على unknown زي ما تايبسكريبت بيقترح.
  return data as unknown as (EmployeeApprovalRequest & {
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
