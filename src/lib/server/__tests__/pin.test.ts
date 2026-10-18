// @vitest-environment node
import { describe, expect, it } from "vitest";
import { afterAttempt, hashPin, LOCK_MS, lockRemaining, MAX_ATTEMPTS, tokenFor, tokenKey, verifyPin, verifyToken } from "../pin";

const key = tokenKey({ AUTH_SECRET: "test-secret" } as unknown as NodeJS.ProcessEnv);

describe("PIN hashing", () => {
  it("hashes with a random salt and verifies only the right PIN", () => {
    const a = hashPin("1234");
    const b = hashPin("1234");
    expect(a).not.toBe(b); // salted
    expect(a).not.toContain("1234");
    expect(verifyPin("1234", a)).toBe(true);
    expect(verifyPin("1235", a)).toBe(false);
    expect(verifyPin("12345", a)).toBe(false);
    expect(verifyPin("1234", null)).toBe(false);
    expect(verifyPin("1234", "garbage")).toBe(false);
  });
  it("rejects PINs that aren't exactly 4 digits", () => {
    expect(() => hashPin("123")).toThrow();
    expect(() => hashPin("12a4")).toThrow();
  });
});

describe("device tokens", () => {
  it("are valid for the current PIN and stop working when the PIN changes", () => {
    const h1 = hashPin("1111");
    const t = tokenFor("learner-1", h1, key);
    expect(verifyToken("learner-1", h1, t, key)).toBe(true);
    expect(verifyToken("learner-2", h1, t, key)).toBe(false);
    const h2 = hashPin("2222");
    expect(verifyToken("learner-1", h2, t, key)).toBe(false);
    expect(verifyToken("learner-1", h1, null, key)).toBe(false);
    expect(verifyToken("learner-1", null, t, key)).toBe(false);
  });
  it("depend on the server secret", () => {
    const h = hashPin("1111");
    const other = tokenKey({ AUTH_SECRET: "different" } as unknown as NodeJS.ProcessEnv);
    expect(verifyToken("x", h, tokenFor("x", h, key), other)).toBe(false);
    expect(() => tokenKey({} as unknown as NodeJS.ProcessEnv)).toThrow();
    expect(tokenKey({ SUPABASE_SECRET_KEY: "sb_secret_x" } as unknown as NodeJS.ProcessEnv)).toHaveLength(32);
  });
});

describe("lockout", () => {
  it("locks for 5 minutes after the 5th wrong PIN, and a right PIN resets", () => {
    let st = { attempts: 0, lockedUntil: null as number | null };
    const now = 1_000_000;
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      const r = afterAttempt(st, false, now);
      expect(r.locked).toBe(false);
      expect(r.attemptsLeft).toBe(MAX_ATTEMPTS - i);
      st = r;
    }
    const locked = afterAttempt(st, false, now);
    expect(locked.locked).toBe(true);
    expect(lockRemaining(locked, now)).toBe(LOCK_MS);
    expect(lockRemaining(locked, now + LOCK_MS + 1)).toBe(0);
    expect(afterAttempt({ attempts: 3, lockedUntil: null }, true, now)).toMatchObject({ attempts: 0, lockedUntil: null, locked: false });
  });
});
