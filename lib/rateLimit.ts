// A small in-memory limiter for routes that answer before anyone is
// signed in, where there is no user id to count against.
//
// Honest about what it is: per-process, so it resets on deploy and
// does not coordinate across instances. That is fine for what it's
// guarding - turning "guess the invite code as fast as HTTP allows"
// into "guess a handful of times a minute" is the whole win, and a
// serious attacker was never going to be stopped by this alone. If
// the app ever runs on several instances at once, this wants to move
// to the database.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const MAX_TRACKED_KEYS = 10_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    // Cheap guard against the map itself becoming the attack: once it
    // is implausibly large, drop everything that has already expired.
    if (buckets.size > MAX_TRACKED_KEYS) {
      for (const [k, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(k);
      }
    }

    buckets.set(key, { count: 1, resetAt: now + windowMs });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

// Behind a proxy the socket address is the proxy's. x-forwarded-for is
// client-controlled and trivially spoofed, so this is a way of
// grouping ordinary callers, not of identifying an attacker.
export function clientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";

  return `${prefix}:${ip}`;
}
