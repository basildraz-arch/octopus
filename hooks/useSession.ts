"use client";

import { useCallback, useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth.service";
import { getBusiness } from "@/repositories/business.repository";
import { hasFeature as checkFeature } from "@/lib/features";
import type { User } from "@/types/user";
import type { Business, FeatureKey } from "@/types/business";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(async (currentUser) => {
        setUser(currentUser);

        if (currentUser) {
          const currentBusiness = await getBusiness(currentUser.business_id);
          setBusiness(currentBusiness);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const hasFeature = useCallback(
    (feature: FeatureKey) => checkFeature(business, feature),
    [business]
  );

  return { user, business, hasFeature, loading };
}
