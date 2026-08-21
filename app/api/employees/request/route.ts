import { NextRequest, NextResponse } from "next/server";

import { requireBusinessOwner } from "@/lib/requireBusinessOwner";
import { hashPin } from "@/lib/pin";
import { validatePin } from "@/lib/pinRules";
import {
  PERMISSION_ORDER as ALL_PERMISSIONS,
  STAFF_ROLES,
  type PermissionKey,
  type StaffRole,
} from "@/lib/permissions";
import {
  buildEmployeeEmail,
  normalizeBusinessCode,
  normalizeUsername,
  suggestBusinessCode,
  validateBusinessCode,
  validateUsername,
} from "@/lib/employeeEmail";

const UNIQUE_VIOLATION = "23505";
const MAX_CODE_ATTEMPTS = 25;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

// Creating the request moved server-side (it used to be a direct RLS
// insert from the browser) for one reason: the PIN. Hashing has to
// happen where the plaintext can be discarded immediately, and a
// browser is not that place.
export async function POST(request: NextRequest) {
  const auth = await requireBusinessOwner(request);

  if (!auth.ok) return auth.response;

  const { adminClient, businessId, ownerUserId } = auth.context;

  const body = await request.json().catch(() => null);

  const fullName =
    typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const username = typeof body?.username === "string" ? body.username : "";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const requestedCode =
    typeof body?.businessCode === "string" ? body.businessCode : "";

  // Validated here rather than trusted, because these two decide what
  // the account will be allowed to do the moment it exists. The
  // database has the same check constraints (migration 049) - this
  // one exists to return a readable error instead of a 500.
  const staffRole =
    typeof body?.staffRole === "string" &&
    STAFF_ROLES.includes(body.staffRole as StaffRole)
      ? (body.staffRole as StaffRole)
      : "cashier";

  const extraPermissions: string[] = Array.isArray(body?.extraPermissions)
    ? body.extraPermissions.filter(
        (permission: unknown) =>
          typeof permission === "string" &&
          ALL_PERMISSIONS.includes(permission as PermissionKey)
      )
    : [];

  if (!fullName) {
    return NextResponse.json({ error: "اسم الموظف مطلوب" }, { status: 400 });
  }

  const usernameError = validateUsername(username);

  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  const pinError = validatePin(pin);

  if (pinError) {
    return NextResponse.json({ error: pinError }, { status: 400 });
  }

  const { data: business, error: businessError } = await adminClient
    .from("businesses")
    .select("id, name, employee_email_code")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    return NextResponse.json(
      { error: "تعذر العثور على بيانات النشاط" },
      { status: 404 }
    );
  }

  // Set once, then frozen by the protect_employee_email_code trigger.
  let businessCode: string | null = business.employee_email_code;

  if (!businessCode) {
    const preferred = normalizeBusinessCode(requestedCode);

    if (preferred) {
      const codeError = validateBusinessCode(preferred);

      if (codeError) {
        return NextResponse.json({ error: codeError }, { status: 400 });
      }
    }

    // Try what the owner typed first; only fall back to generated
    // suffixes if they left it blank.
    const candidates = preferred
      ? [preferred]
      : Array.from({ length: MAX_CODE_ATTEMPTS }, (_, i) =>
          suggestBusinessCode(business.name, i + 1)
        );

    for (const candidate of candidates) {
      const { data, error } = await adminClient
        .from("businesses")
        .update({ employee_email_code: candidate })
        .eq("id", businessId)
        .select("employee_email_code")
        .single();

      if (!error && data) {
        businessCode = data.employee_email_code;
        break;
      }

      if (error && !isUniqueViolation(error)) {
        console.error("request-employee: setting shop code failed", error);

        return NextResponse.json(
          { error: "تعذر حفظ كود المحل" },
          { status: 500 }
        );
      }
    }

    if (!businessCode) {
      return NextResponse.json(
        {
          error: preferred
            ? `كود المحل "${preferred}" متاخد بمحل تاني - اختار كود غيره`
            : "تعذر توليد كود للمحل",
        },
        { status: 409 }
      );
    }
  }

  const generatedEmail = buildEmployeeEmail(username, businessCode);

  const { data: created, error: insertError } = await adminClient
    .from("employee_approval_requests")
    .insert({
      business_id: businessId,
      requested_by: ownerUserId,
      full_name: fullName,
      phone: phone || null,
      generated_email: generatedEmail,
      pin_hash: hashPin(pin),
      staff_role: staffRole,
      extra_permissions: extraPermissions,
    })
    .select("id, generated_email")
    .single();

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      return NextResponse.json(
        {
          error: `اسم الدخول "${normalizeUsername(
            username
          )}" متاخد قبل كده - اختار اسم تاني`,
        },
        { status: 409 }
      );
    }

    console.error("request-employee: insert failed", insertError);

    return NextResponse.json({ error: "تعذر إرسال الطلب" }, { status: 500 });
  }

  return NextResponse.json({
    id: created.id,
    email: created.generated_email,
    businessCode,
  });
}
