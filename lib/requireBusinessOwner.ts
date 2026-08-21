import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type BusinessOwnerContext = {
  // Bound to the caller's own access token - RLS applies normally.
  scopedClient: SupabaseClient;

  // Service role - bypasses RLS entirely. Only reachable after the
  // caller has already been confirmed as an active owner, and only
  // for the one privileged operation the calling route exists to
  // perform (touching auth.users, which RLS cannot express).
  adminClient: SupabaseClient;

  ownerUserId: string;
  businessId: string;
};

// Entry point for owner-only API routes.
//
// Re-derives "is an active owner of business X" from the database on
// every call rather than trusting anything the client sends - same
// discipline as requirePlatformAdmin. The role is read through the
// caller's OWN token (so RLS applies), never from the request body.
export async function requireBusinessOwner(
  request: NextRequest
): Promise<
  | { ok: true; context: BusinessOwnerContext }
  | { ok: false; response: NextResponse }
> {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: "غير مصرّح" }, { status: 401 }),
    };
  }

  const scopedClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );

  const {
    data: { user: authUser },
    error: authError,
  } = await scopedClient.auth.getUser(accessToken);

  if (authError || !authUser) {
    return {
      ok: false,
      response: NextResponse.json({ error: "غير مصرّح" }, { status: 401 }),
    };
  }

  const { data: appUser, error: userError } = await scopedClient
    .from("users")
    .select("id, business_id, role, active")
    .eq("auth_user_id", authUser.id)
    .single();

  if (userError || !appUser) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "تعذر التحقق من الحساب" },
        { status: 403 }
      ),
    };
  }

  if (appUser.role !== "owner" || !appUser.active) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "الصلاحية دي لصاحب النشاط بس" },
        { status: 403 }
      ),
    };
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  return {
    ok: true,
    context: {
      scopedClient,
      adminClient,
      ownerUserId: appUser.id,
      businessId: appUser.business_id,
    },
  };
}
