// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => {} }));

const post = (body: unknown = {}) => new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("API routes without a database (local-first mode)", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (saved !== undefined) process.env.DATABASE_URL = saved;
  });

  it.each([
    ["register", () => import("@/app/api/auth/register/route").then((m) => m.POST(post({ email: "a@b.co", password: "12345678" })))],
    ["login", () => import("@/app/api/auth/login/route").then((m) => m.POST(post({ email: "a@b.co", password: "x" })))],
    ["logout", () => import("@/app/api/auth/logout/route").then((m) => m.POST(post()))],
    ["sync POST", () => import("@/app/api/sync/route").then((m) => m.POST(post({ bundle: {} })))],
    ["sync GET", () => import("@/app/api/sync/route").then((m) => m.GET())],
    ["google", () => import("@/app/api/auth/google/route").then((m) => m.GET(new Request("http://localhost/api/auth/google")))],
  ])("%s responds 503 { enabled: false }", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ enabled: false });
  });

  it("me responds 200 { enabled: false, user: null }", async () => {
    const { GET } = await import("@/app/api/auth/me/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false, google: false, user: null });
  });
});
