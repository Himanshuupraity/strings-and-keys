// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const bundle = { app: "melody-masters", version: 1, exportedAt: new Date().toISOString(), prefs: {}, collections: {} };

describe("learner routes without Supabase", () => {
  beforeEach(() => ENV_KEYS.forEach((k) => vi.stubEnv(k, "")));
  afterEach(() => vi.unstubAllEnvs());

  it("MM_DISABLE_SUPABASE forces local mode even when keys are present (used by e2e tests)", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    vi.stubEnv("MM_DISABLE_SUPABASE", "1");
    const { isSupabaseEnabled } = await import("@/lib/server/supabase");
    expect(isSupabaseEnabled()).toBe(false);
  });
  it("GET list reports disabled (so the app saves locally)", async () => {
    const { GET } = await import("@/app/api/learners/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false, learners: [] });
  });
  it("POST / GET / PUT return 503 enabled:false", async () => {
    const list = await import("@/app/api/learners/route");
    const one = await import("@/app/api/learners/[id]/route");
    const id = crypto.randomUUID();
    expect((await list.POST(new Request("http://x/api/learners", { method: "POST", body: JSON.stringify({ name: "Asha" }) }))).status).toBe(503);
    expect((await one.GET(new Request("http://x"), ctx(id))).status).toBe(503);
    expect((await one.PUT(new Request("http://x", { method: "PUT", body: JSON.stringify({ bundle }) }), ctx(id))).status).toBe(503);
  });
});

describe("learner routes with Supabase (data layer mocked)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    vi.doMock("@/lib/server/learners", async (orig) => {
      const real = await orig<typeof import("@/lib/server/learners")>();
      return {
        ...real,
        listLearners: vi.fn(async () => ({ pinSupported: true, learners: [{ id: "1", name: "Asha", updatedAt: "2026-10-18T10:00:00Z", hasPin: false }] })),
        createOrFindLearner: vi.fn(async (name: string) => ({ learner: { id: "2", name, updatedAt: "t" }, existed: name === "Asha" })),
        getLearnerAuth: vi.fn(async () => ({ pinSupported: true, exists: true, pinHash: null, attempts: 0, lockedUntil: null })),
        getLearner: vi.fn(async () => null),
        saveLearner: vi.fn(async () => ({ status: "conflict", updatedAt: "2026-10-18T11:00:00Z" })),
      };
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/server/learners");
  });

  it("lists names", async () => {
    const { GET } = await import("@/app/api/learners/route");
    expect(await (await GET()).json()).toMatchObject({ enabled: true, pinSupported: true, learners: [{ name: "Asha", hasPin: false }] });
  });
  it("validates names and reports existing learners", async () => {
    const { POST } = await import("@/app/api/learners/route");
    const post = (name: unknown) => POST(new Request("http://x/api/learners", { method: "POST", headers: { "x-forwarded-for": `ip-${Math.random()}` }, body: JSON.stringify({ name }) }));
    expect((await post("")).status).toBe(400);
    expect((await post("<b>x</b>")).status).toBe(400);
    expect((await post("Ravi")).status).toBe(201);
    const existing = await post("Asha");
    expect(existing.status).toBe(200);
    expect(await existing.json()).toMatchObject({ existed: true });
  });
  it("rejects bad ids and bad bundles; surfaces conflicts as 409", async () => {
    const one = await import("@/app/api/learners/[id]/route");
    expect((await one.GET(new Request("http://x"), ctx("not-a-uuid"))).status).toBe(404);
    expect((await one.GET(new Request("http://x"), ctx(crypto.randomUUID()))).status).toBe(404);
    const id = crypto.randomUUID();
    expect((await one.PUT(new Request("http://x", { method: "PUT", body: JSON.stringify({ bundle: { nope: 1 } }) }), ctx(id))).status).toBe(400);
    expect((await one.PUT(new Request("http://x", { method: "PUT", body: "{" }), ctx(id))).status).toBe(400);
    expect((await one.PUT(new Request("http://x", { method: "PUT", body: JSON.stringify({ bundle, baseUpdatedAt: "2026-10-18T10:00:00Z" }) }), ctx(id))).status).toBe(409);
  });
  it("rate-limits profile creation per network", async () => {
    const { POST } = await import("@/app/api/learners/route");
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await POST(new Request("http://x/api/learners", { method: "POST", headers: { "x-forwarded-for": "9.9.9.9" }, body: JSON.stringify({ name: `L${i}` }) }))).status);
    expect(statuses.filter((s) => s === 429).length).toBe(2);
  });
});
