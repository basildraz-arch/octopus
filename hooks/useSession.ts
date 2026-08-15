"use client";

import { useCallback, useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth.service";
import { getBusiness } from "@/repositories/business.repository";
import { hasFeature as checkFeature } from "@/lib/features";
import { supabase } from "@/lib/supabase";
import type { User } from "@/types/user";
import type { Business, FeatureKey } from "@/types/business";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      // getCurrentUser() throws when there's no active session (Supabase
      // reports "Auth session missing!" rather than just returning null) -
      // that's an expected, normal state on public pages, not a real
      // error, so it must not become an uncaught rejection here.
      let currentUser: User | null = null;
      try {
        currentUser = await getCurrentUser();
      } catch {
        currentUser = null;
      }
      if (cancelled) return;

      setUser(currentUser);

      if (currentUser) {
        const currentBusiness = await getBusiness(currentUser.business_id);
        if (!cancelled) setBusiness(currentBusiness);
      } else {
        setBusiness(null);
      }

      if (!cancelled) setLoading(false);
    }

    loadSession();

    // Components mounted once at the app root (e.g. the mascot) persist
    // across login/logout instead of remounting like route layouts do -
    // without this they'd be stuck with whatever session existed at
    // their very first mount. React to auth changes, not just the
    // initial check.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSession();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const hasFeature = useCallback(
    (feature: FeatureKey) => checkFeature(business, feature),
    [business]
  );

  return { user, business, hasFeature, loading };
}
