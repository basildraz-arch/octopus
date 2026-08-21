import crypto from "crypto";

// SERVER ONLY. This module imports node:crypto - never import it from
// a "use client" component. Client code wants lib/pinRules.ts, which
// carries the lengths, the lockout numbers, and validatePin().

const SCRYPT_KEYLEN = 64;

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pin, salt, SCRYPT_KEYLEN);

  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");

  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");

  const actual = crypto.scryptSync(
    pin,
    Buffer.from(saltHex, "hex"),
    expected.length
  );

  // timingSafeEqual throws on length mismatch, so guard first.
  if (expected.length !== actual.length) return false;

  return crypto.timingSafeEqual(expected, actual);
}
