import { createHmac, hkdfSync, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Server-only helpers for the optional 4-digit learner PIN.
 * - PINs are hashed with scrypt + a random salt; hashes never leave the server.
 * - Device tokens are HMAC(key, learnerId:pinHash), so changing the PIN invalidates old tokens.
 * - After MAX_ATTEMPTS wrong PINs the profile is locked for LOCK_MS.
 */
if (typeof window !== "undefined") throw new Error("pin.ts must only be imported on the server");

export const PIN_RE = /^\d{4}$/;
export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 5 * 60_000;

const N = 16384;

export function hashPin(pin: string): string {
  if (!PIN_RE.test(pin)) throw new Error("PIN must be exactly 4 digits");
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32, { N, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !PIN_RE.test(pin)) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(pin, Buffer.from(saltB64, "base64"), expected.length, { N, r: 8, p: 1 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Server key for tokens: AUTH_SECRET if set, else derived from the Supabase secret key (never exposed). */
export function tokenKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const base = env.AUTH_SECRET || env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base) throw new Error("No server secret available for PIN tokens");
  return Buffer.from(hkdfSync("sha256", base, "melody-masters", "learner-pin-token-v1", 32));
}

export function tokenFor(learnerId: string, pinHash: string, key = tokenKey()): string {
  return createHmac("sha256", key).update(`${learnerId}:${pinHash}`).digest("base64url");
}

export function verifyToken(learnerId: string, pinHash: string | null | undefined, token: string | null | undefined, key = tokenKey()): boolean {
  if (!pinHash || !token) return false;
  const expected = Buffer.from(tokenFor(learnerId, pinHash, key));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface PinAttemptState {
  attempts: number;
  lockedUntil: number | null;
}

/** Remaining lock time in ms (0 when not locked). */
export function lockRemaining(state: PinAttemptState, now = Date.now()): number {
  return state.lockedUntil && state.lockedUntil > now ? state.lockedUntil - now : 0;
}

/** State after one attempt. A correct PIN resets; the 5th wrong one locks and resets the counter. */
export function afterAttempt(state: PinAttemptState, correct: boolean, now = Date.now()): PinAttemptState & { locked: boolean; attemptsLeft: number } {
  if (correct) return { attempts: 0, lockedUntil: null, locked: false, attemptsLeft: MAX_ATTEMPTS };
  const attempts = state.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) return { attempts: 0, lockedUntil: now + LOCK_MS, locked: true, attemptsLeft: 0 };
  return { attempts, lockedUntil: null, locked: false, attemptsLeft: MAX_ATTEMPTS - attempts };
}
