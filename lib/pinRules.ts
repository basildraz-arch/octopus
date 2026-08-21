// Pure PIN rules - no Node crypto, no server-only imports, so this is
// safe to pull into a "use client" component. The hashing itself lives
// in lib/pin.ts, which is server-only; importing that file from the
// browser would drag node:crypto into the client bundle and break the
// build.

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

// 5 wrong taps then a 5 minute freeze. With 10,000 possible 4-digit
// PINs, this caps an attacker at ~60 guesses an hour - it would take
// years to walk the space, while a cashier who fat-fingers their PIN
// twice is never inconvenienced.
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 5;

// Returns an Arabic error message, or null when the PIN is acceptable.
export function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) {
    return "الرقم السري لازم يكون أرقام بس";
  }

  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    return `الرقم السري لازم يكون من ${PIN_MIN_LENGTH} لـ ${PIN_MAX_LENGTH} أرقام`;
  }

  // 0000 / 1111 / 9999 are the first things anyone tries, and unlike
  // 1234 they carry no "easy to remember" benefit worth the risk.
  if (/^(\d)\1+$/.test(pin)) {
    return "مينفعش كل الأرقام تكون زي بعض";
  }

  return null;
}
