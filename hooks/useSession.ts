"use client";

import { useCallback, useContext } from "react";

import { SessionContext } from "@/components/session/SessionProvider";
import { hasFeature as checkFeature } from "@/lib/features";
import { can as checkPermission, type PermissionKey } from "@/lib/permissions";
import type { FeatureKey } from "@/types/business";

// The session itself is loaded once, above the router, by
// SessionProvider - see the note in that file for why. This hook is
// now just the reader, so the 29 components that call it share one
// result instead of each fetching their own.
export function useSession() {
  const ctx = useContext(SessionContext);

  if (!ctx) {
    throw new Error("useSession() needs <SessionProvider> above it");
  }

  const { user, business, isPlatformAdmin, loading, suspended, refresh } = ctx;

  const hasFeature = useCallback(
    (feature: FeatureKey) => checkFeature(business, feature),
    [business]
  );

  // Whether to SHOW something. Never the only thing standing between
  // a person and an action - every write is checked again by RLS using
  // has_permission(), which since migration 065 also refuses a
  // switched-off person and a suspended shop.
  const can = useCallback(
    (permission: PermissionKey) => checkPermission(user, permission),
    [user]
  );

  return {
    user,
    business,
    hasFeature,
    can,
    isPlatformAdmin,
    loading,
    suspended,
    refresh,
  };
}
