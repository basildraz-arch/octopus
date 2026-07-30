"use client";

import { useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth.service";
import type { User } from "@/types/user";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
