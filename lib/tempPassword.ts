import crypto from "crypto";

// SERVER ONLY (imports node:crypto).
//
// The Supabase Auth password behind a cashier account. Nobody ever
// sees, types, or is told this value: cashiers sign in with a PIN
// (lib/pin.ts + /api/auth/pin-login), and the server mints their
// session directly via a one-time magic-link token. The password only
// exists because Supabase Auth requires accounts to have one.
//
// Because it is never read aloud or typed, it carries none of the
// readability constraints a human-facing credential would, and should
// simply be as strong as possible.
export function generateStrongPassword(): string {
  return crypto.randomBytes(24).toString("base64url");
}
