// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPin, tokenFor } from "../pin";

const ID = "7d3f7a52-2c58-4b2a-9d1b-6f1d2a9c1e11";
const ctx = { params: Promise.resolve({ id: ID }) };
const bundle = { app: "melody-masters", version: 1, exportedAt: new Date().toISOString(), prefs: {}, collections: {} };

type Auth = { pinSupported: boolean; exists: boolean; pinHash: string | null; attempts: number; lockedUntil: number | null };
let auth: Auth;
const saved: { pinHash?: string | null; attempts?: number; lockedUntil?: number | null } = {};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
  vi.stubEnv("MM_DISABLE_SUPABASE", "");
  vi.stubEnv("AUTH_SECRET", "unit-test-secret");
  auth = { pinSupported: true, exists: true, pinHash: hashPin("4321"), attempts: 0, lockedUntil: null };
  vi.doMock("@/lib/server/learners", async (orig) => {
    const real = await orig<typeof import("@/lib/server/learners")>();
    return {
      ...real,
      getLearnerAuth: vi.fn(async () => auth),
      getLearner: vi.fn(async () => ({ id: ID, name: "Asha", updatedAt: "t", data: bundle })),
      saveLearner: vi.fn(async () => ({ status: "saved", updatedAt: "t2" })),
      saveAttemptState: vi.fn(async (_id: string, attempts: number, lockedUntil: number | null) => {
        saved.attempts = attempts;
        saved.lockedUntil = lockedUntil;
        auth = { ...auth, attempts, lockedUntil };
      }),
      savePinHash: vi.fn(async (_id: string, h: string | null) => {
        saved.pinHash = h;
        auth = { ...auth, pinHash: h, attempts: 0, lockedUntil: null };
      }),
    };
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/server/learners");
});

const req = (method: string, body?: unknown, token?: string) =>
  new Request(`http://x/api/learners/${ID}`, { method, headers: { "x-forwarded-for": `ip-${Math.random()}`, ...(token ? { "x-learner-token": token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

describe("PIN-protected learner routes", () => {
  it("GET/PUT need a valid device token when a PIN is set", async () => {
    const one = await import("@/app/api/learners/[id]/route");
    const res = await one.GET(req("GET"), ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ pinRequired: true });
    expect((await one.PUT(req("PUT", { bundle }), ctx)).status).toBe(401);
    const token = tokenFor(ID, auth.pinHash!);
    expect((await one.GET(req("GET", undefined, token), ctx)).status).toBe(200);
    expect((await one.PUT(req("PUT", { bundle }, token), ctx)).status).toBe(200);
    expect((await one.GET(req("GET", undefined, "forged"), ctx)).status).toBe(401);
  });

  it("profiles without a PIN work without a token", async () => {
    auth.pinHash = null;
    const one = await import("@/app/api/learners/[id]/route");
    expect((await one.GET(req("GET"), ctx)).status).toBe(200);
  });

  it("unlock returns a token for the right PIN, counts wrong ones and locks after 5", async () => {
    const { POST } = await import("@/app/api/learners/[id]/unlock/route");
    const ok = await POST(req("POST", { pin: "4321" }), ctx);
    expect(ok.status).toBe(200);
    const { token } = await ok.json();
    expect(token).toBe(tokenFor(ID, auth.pinHash!));
    for (let i = 1; i <= 4; i++) {
      const r = await POST(req("POST", { pin: "0000" }), ctx);
      expect(r.status).toBe(403);
      expect((await r.json()).attemptsLeft).toBe(5 - i);
    }
    const locked = await POST(req("POST", { pin: "0000" }), ctx);
    expect(locked.status).toBe(429);
    expect(locked.headers.get("Retry-After")).toBeTruthy();
    // Even the right PIN is refused while locked.
    expect((await POST(req("POST", { pin: "4321" }), ctx)).status).toBe(429);
    expect((await POST(req("POST", { pin: "12" }), ctx)).status).toBe(400);
  });

  it("set / change / remove PIN rules", async () => {
    const { PUT } = await import("@/app/api/learners/[id]/pin/route");
    // Changing needs the current PIN or a token.
    expect((await PUT(req("PUT", { newPin: "1111" }), ctx)).status).toBe(401);
    expect((await PUT(req("PUT", { newPin: "1111", currentPin: "9999" }), ctx)).status).toBe(401);
    const changed = await PUT(req("PUT", { newPin: "1111", currentPin: "4321" }), ctx);
    expect(changed.status).toBe(200);
    const { token } = await changed.json();
    expect(token).toBe(tokenFor(ID, saved.pinHash!));
    // Remove with the new token.
    const removed = await PUT(req("PUT", { newPin: null }, token), ctx);
    expect(removed.status).toBe(200);
    expect(saved.pinHash).toBeNull();
    // No PIN set: anyone (on this device flow) can set one.
    expect((await PUT(req("PUT", { newPin: "2222" }), ctx)).status).toBe(200);
    expect((await PUT(req("PUT", { newPin: "22" }), ctx)).status).toBe(400);
  });

  it("explains when the database hasn't had the PIN update yet", async () => {
    auth = { pinSupported: false, exists: true, pinHash: null, attempts: 0, lockedUntil: null };
    const { POST } = await import("@/app/api/learners/[id]/unlock/route");
    const r = await POST(req("POST", { pin: "1234" }), ctx);
    expect(r.status).toBe(501);
    expect((await r.json()).pinSupported).toBe(false);
  });
});
