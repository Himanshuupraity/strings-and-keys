// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../auth/password";
import { hashToken, newSessionToken, pkceChallenge } from "../auth/tokens";
import { RateLimiter, clientIp } from "../auth/rate-limit";
import { LoginSchema, RegisterSchema } from "../auth/validation";

describe("password hashing", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("correct horse");
    const b = await hashPassword("correct horse");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse", a)).toBe(true);
    expect(await verifyPassword("wrong horse", a)).toBe(false);
  });
  it("rejects malformed or missing hashes", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
  });
});

describe("session tokens", () => {
  it("are long, random and stored only as SHA-256", () => {
    const t = newSessionToken();
    expect(t.length).toBeGreaterThanOrEqual(43);
    expect(newSessionToken()).not.toBe(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
  });
  it("PKCE challenge matches RFC 7636 example", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("rate limiter", () => {
  it("allows up to the limit within the window, then blocks until it slides", () => {
    let now = 0;
    const rl = new RateLimiter(3, 1000, () => now);
    expect([1, 2, 3].map(() => rl.check("ip").ok)).toEqual([true, true, true]);
    const blocked = rl.check("ip");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(rl.check("other").ok).toBe(true);
    now = 1001;
    expect(rl.check("ip").ok).toBe(true);
  });
  it("reads the first forwarded IP", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } }))).toBe("1.2.3.4");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});

describe("validation", () => {
  it("normalises email and enforces password length", () => {
    expect(RegisterSchema.parse({ email: " Me@Example.COM ", password: "12345678" }).email).toBe("me@example.com");
    expect(RegisterSchema.safeParse({ email: "me@example.com", password: "short" }).success).toBe(false);
    expect(LoginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });
});
