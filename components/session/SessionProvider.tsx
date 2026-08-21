"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getCurrentUser } from "@/services/auth.service";
import { getBusiness } from "@/repositories/business.repository";
import { isCurrentUserPlatformAdmin } from "@/repositories/platformAdmin.repository";
import { supabase } from "@/lib/supabase";
import type { User } from "@/types/user";
import type { Business } from "@/types/business";

// ONE session load for the whole app.
//
// useSession() used to do the fetching itself, and 29 components call
// it - the dashboard layout, the header, the sidebar, the bottom bar,
// the notification bell, the assistant, and the page itself all mount
// together. Each copy independently ran getCurrentUser() (an auth call
// plus a users row), getBusiness() and isCurrentUserPlatformAdmin():
// four requests each, so roughly thirty on a single screen.
//
// Then each copy also subscribed to onAuthStateChange, and Supabase
// fires several events around a login (INITIAL_SESSION, SIGNED_IN, and
// TOKEN_REFRESHED), so every one of those multiplied the whole set
// again. That is the burst of verification requests reported at login.
//
// The fetching moved here, above the router, so it happens once and
// every consumer reads the same result.

// Why the shop can or cannot work today. Kept as four named states
// rather than a boolean because they need different things said to
// them: "switched off" is a conversation with Basel, "ran out" is a
// payment, and "runs out on Tuesday" is a warning while everything
// still works.
export type SubscriptionStatus =
  | "ok"
  | "expiring"
  | "expired"
  | "suspended";

export type Subscription = {
  status: SubscriptionStatus;

  /** Whole days until it runs out. Negative once it has. */
  daysLeft: number | null;

  endsAt: string | null;

  /** True while nothing can be written - expired or switched off. */
  locked: boolean;
};

// Matches the week Basel asked for: the warning starts seven days out.
const WARN_WITHIN_DAYS = 7;

export type SessionValue = {
  user: User | null;
  business: Business | null;
  isPlatformAdmin: boolean;
  loading: boolean;

  subscription: Subscription;

  /** Re-read the session after something changes it (e.g. paying). */
  refresh: () => Promise<void>;
};

// The same rule migration 066 applies in the database, restated for
// the screen. The database is the one that decides - this only decides
// what to SAY. If the two ever disagree the database wins and the
// person meets a refused write, which is why the wording never
// promises anything, it only warns.
export function readSubscription(business: Business | null): Subscription {
  if (!business) {
    return { status: "ok", daysLeft: null, endsAt: null, locked: false };
  }

  // A trial and a paid month end the same way; only the date differs.
  const endsAt = business.subscription_expires_at ?? business.trial_ends_at ?? null;

  if (business.active === false) {
    return { status: "suspended", daysLeft: null, endsAt, locked: true };
  }

  if (!endsAt) {
    return { status: "ok", daysLeft: null, endsAt: null, locked: false };
  }

  const msLeft = new Date(endsAt).getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / 86_400_000);

  if (msLeft <= 0) {
    return { status: "expired", daysLeft, endsAt, locked: true };
  }

  if (daysLeft <= WARN_WITHIN_DAYS) {
    return { status: "expiring", daysLeft, endsAt, locked: false };
  }

  return { status: "ok", daysLeft, endsAt, locked: false };
}

export const SessionContext = createContext<SessionValue | null>(null);

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const cancelled = useRef(false);

  // Two screens mounting at once must not both trigger a load. Holding
  // the in-flight promise means the second caller waits for the first
  // instead of starting a second round of requests.
  const inFlight = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    if (inFlight.current) return inFlight.current;

    const run = (async () => {
      // getCurrentUser() throws when there's no session (Supabase says
      // "Auth session missing!" rather than returning null). That is a
      // normal state on public pages, not an error.
      //
      // It also returns null for somebody who has been switched off,
      // because since migration 065 they can no longer read their own
      // users row - which is exactly right: they land back on /login
      // and the message there tells them why.
      let currentUser: User | null = null;

      try {
        currentUser = await getCurrentUser();
      } catch {
        currentUser = null;
      }

      if (cancelled.current) return;

      setUser(currentUser);

      if (currentUser) {
        const [currentBusiness, platformAdmin] = await Promise.all([
          getBusiness(currentUser.business_id),
          isCurrentUserPlatformAdmin(),
        ]);

        if (cancelled.current) return;

        setBusiness(currentBusiness);
        setIsPlatformAdmin(platformAdmin);
      } else {
        setBusiness(null);
        setIsPlatformAdmin(false);
      }

      if (!cancelled.current) setLoading(false);
    })();

    inFlight.current = run;

    try {
      await run;
    } finally {
      inFlight.current = null;
    }
  }, []);

  useEffect(() => {
    cancelled.current = false;

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // TOKEN_REFRESHED fires on a timer for as long as the tab is open
      // and means nothing changed about who this is. INITIAL_SESSION is
      // the mount we just handled. Reloading on either is pure traffic.
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;

      load();
    });

    return () => {
      cancelled.current = true;
      subscription.unsubscribe();
    };
  }, [load]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      business,
      isPlatformAdmin,
      loading,
      subscription: readSubscription(business),
      refresh: load,
    }),
    [user, business, isPlatformAdmin, loading, load]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
