import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type PlatformAdminContext = {
  // Bound to the caller's own access token - RLS applies normally.
  // Use this for anything that should stay subject to RLS.
  scopedClient: SupabaseClient;

  // Service role - bypasses RLS entirely. Only reachable after
  // is_platform_admin() has already confirmed the caller server-side,
  // and only ever used for the one specific privileged write the
  // calling route exists to perform (e.g. creating an auth user +
  // its `users` row together, which RLS can't express because it
  // spans auth.users too).
  adminClient: SupabaseClient;

  authUserId: string;
  platformAdminId: string;
};

// Entry point for every Master-only API route.
//
// This does NOT trust anything the client claims about its own
// role - it re-derives platform-admin status from the database via
// is_platform_admin() (migration 031), the exact same function RLS
// itself calls. That's deliberate: the app previously shipped a bug
// where a sensitive endpoint skipped a server-side role check and
// trusted the client instead (fixed by adding a real 403 check in
// the API). This helper exists so every Master route goes through
// one single, already-reviewed check instead of each route
// re-implementing it slightly differently.
export async function requirePlatformAdmin(
  request: NextRequest
): Promise<
  | { ok: true; context: PlatformAdminContext }
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

  const { data: isAdmin, error: adminCheckError } = await scopedClient.rpc(
    "is_platform_admin"
  );

  if (adminCheckError || !isAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "الصلاحية دي مش متاحة لحسابك" },
        { status: 403 }
      ),
    };
  }

  // Service role client, only reachable past the check above.
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: platformAdminRow, error: rowError } = await adminClient
    .from("platform_admins")
    .select("id")
    .eq("auth_user_id", authUser.id)
    .single();

  if (rowError || !platformAdminRow) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "تعذر التحقق من حساب Master" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    context: {
      scopedClient,
      adminClient,
      authUserId: authUser.id,
      platformAdminId: platformAdminRow.id,
    },
  };
}
