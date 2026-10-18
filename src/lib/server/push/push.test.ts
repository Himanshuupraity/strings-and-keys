// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { isDue, localParts, reminderMessage, selectDue, SubscribeBodySchema, timeToMinutes } from "./schedule";
import { runReminderPass } from "./cron";
import type { SubscriptionRow } from "./store";

const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } };

describe("schemas", () => {
  it("accepts a valid subscribe body", () => {
    expect(SubscribeBodySchema.safeParse({ subscription: sub, reminderTime: "19:00", timezone: "Asia/Kolkata" }).success).toBe(true);
  });
  it("rejects bad time, unknown time zone, non-https endpoint", () => {
    expect(SubscribeBodySchema.safeParse({ subscription: sub, reminderTime: "25:00", timezone: "Asia/Kolkata" }).success).toBe(false);
    expect(SubscribeBodySchema.safeParse({ subscription: sub, reminderTime: "7pm", timezone: "Asia/Kolkata" }).success).toBe(false);
    expect(SubscribeBodySchema.safeParse({ subscription: sub, reminderTime: "19:00", timezone: "Mars/Olympus" }).success).toBe(false);
    expect(SubscribeBodySchema.safeParse({ subscription: { ...sub, endpoint: "http://x.com/a" }, reminderTime: "19:00", timezone: "UTC" }).success).toBe(false);
  });
});

describe("is due now (time zones & DST)", () => {
  const row = (t: string, tz: string, last: string | null = null) => ({ reminder_time: t, timezone: tz, enabled: true, last_sent_on: last });

  it("uses the subscriber's local time, not the server's", () => {
    // 13:40 UTC = 19:10 in India (UTC+5:30)
    const now = new Date("2026-10-18T13:40:00Z");
    expect(localParts(now, "Asia/Kolkata")).toEqual({ date: "2026-10-18", minutes: timeToMinutes("19:10") });
    expect(isDue(row("19:00", "Asia/Kolkata"), now)).toBe(true);
    expect(isDue(row("19:30", "Asia/Kolkata"), now)).toBe(false);
    expect(isDue(row("19:00", "America/New_York"), now)).toBe(false); // 09:40 there
  });

  it("sends at most once per local day (idempotent)", () => {
    const now = new Date("2026-10-18T14:00:00Z");
    expect(isDue(row("19:00", "Asia/Kolkata", "2026-10-18"), now)).toBe(false);
    expect(isDue(row("19:00", "Asia/Kolkata", "2026-10-17"), now)).toBe(true);
  });

  it("local date rolls over correctly across midnight UTC", () => {
    // 20:00 UTC on 18 Oct is already 19 Oct 01:30 in India
    const now = new Date("2026-10-18T20:00:00Z");
    expect(localParts(now, "Asia/Kolkata").date).toBe("2026-10-19");
    expect(isDue(row("01:00", "Asia/Kolkata", "2026-10-18"), now)).toBe(true);
  });

  it("handles DST changes (US clocks go back on 1 Nov 2026)", () => {
    // 2 Nov 2026 00:30 UTC = 1 Nov 19:30 EST (UTC-5, after DST ended)
    expect(localParts(new Date("2026-11-02T00:30:00Z"), "America/New_York")).toEqual({ date: "2026-11-01", minutes: timeToMinutes("19:30") });
    // 31 Oct 2026 23:30 UTC = 19:30 EDT (UTC-4, before DST ended)
    expect(localParts(new Date("2026-10-31T23:30:00Z"), "America/New_York")).toEqual({ date: "2026-10-31", minutes: timeToMinutes("19:30") });
  });

  it("disabled or invalid-zone rows are never due", () => {
    const now = new Date("2026-10-18T23:59:00Z");
    expect(isDue({ ...row("00:00", "UTC"), enabled: false }, now)).toBe(false);
    expect(isDue(row("00:00", "Not/AZone"), now)).toBe(false);
  });

  it("messages vary by day and always link to the dashboard", () => {
    const days = ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map(reminderMessage);
    expect(new Set(days.map((m) => m.title)).size).toBeGreaterThan(1);
    expect(days.every((m) => m.url === "/dashboard")).toBe(true);
  });
});

describe("cron pass", () => {
  const mk = (endpoint: string, t: string, last: string | null = null): SubscriptionRow => ({ endpoint, p256dh: "k", auth: "a", learner_id: null, reminder_time: t, timezone: "Asia/Kolkata", enabled: true, last_sent_on: last });

  it("selects due rows with their local date", () => {
    const now = new Date("2026-10-18T13:40:00Z");
    const due = selectDue([mk("a", "19:00"), mk("b", "20:00"), mk("c", "08:00", "2026-10-18")], now);
    expect(due.map((d) => [d.row.endpoint, d.localDate])).toEqual([["a", "2026-10-18"]]);
  });

  it("sends, marks sent, deletes gone subscriptions, counts failures", async () => {
    const rows = [mk("ok", "07:00"), mk("gone", "07:00"), mk("fail", "07:00"), mk("later", "23:00")];
    const marked: string[] = [];
    const removed: string[] = [];
    const r = await runReminderPass(
      {
        list: async () => rows,
        send: async (row) => (row.endpoint === "ok" ? "sent" : row.endpoint === "gone" ? "gone" : "failed"),
        markSent: async (e, d) => void marked.push(`${e}@${d}`),
        remove: async (e) => void removed.push(e),
      },
      new Date("2026-10-18T13:40:00Z"),
    );
    expect(r).toEqual({ checked: 4, sent: 1, removed: 1, failed: 1 });
    expect(marked).toEqual(["ok@2026-10-18"]);
    expect(removed).toEqual(["gone"]);
  });
});

describe("routes when not configured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  const off = () => {
    for (const k of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"]) vi.stubEnv(k, "");
  };

  it("config says disabled and other routes are 503-safe", async () => {
    off();
    const config = await import("@/app/api/push/config/route");
    expect(await (await config.GET()).json()).toEqual({ enabled: false, publicKey: null });
    const subscribe = await import("@/app/api/push/subscribe/route");
    expect((await subscribe.POST(new Request("http://x", { method: "POST", body: "{}" }))).status).toBe(503);
    const test = await import("@/app/api/push/test/route");
    expect((await test.POST(new Request("http://x", { method: "POST", body: "{}" }))).status).toBe(503);
  });

  it("config reports enabled with the public key when VAPID + Supabase are set (no DB call needed)", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "PUBKEY");
    vi.stubEnv("VAPID_PRIVATE_KEY", "PRIV");
    vi.stubEnv("VAPID_SUBJECT", "mailto:a@b.c");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
    vi.stubEnv("MM_DISABLE_SUPABASE", "");
    const config = await import("@/app/api/push/config/route");
    expect(await (await config.GET()).json()).toEqual({ enabled: true, publicKey: "PUBKEY" });
  });

  it("cron requires the secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const cron = await import("@/app/api/push/cron/route");
    expect((await cron.GET(new Request("http://x"))).status).toBe(401);
    expect((await cron.GET(new Request("http://x", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await cron.GET(new Request("http://x", { headers: { authorization: "Bearer " } }))).status).toBe(401);
  });

  it("subscribe validates the body once configured (data layer mocked)", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "P");
    vi.stubEnv("VAPID_PRIVATE_KEY", "Q");
    vi.stubEnv("VAPID_SUBJECT", "mailto:a@b.c");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
    vi.stubEnv("MM_DISABLE_SUPABASE", "");
    const upsert = vi.fn(async () => {});
    vi.doMock("@/lib/server/push/store", async (orig) => ({ ...(await orig<typeof import("./store")>()), upsertSubscription: upsert }));
    const subscribe = await import("@/app/api/push/subscribe/route");
    expect((await subscribe.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ subscription: sub, reminderTime: "99:00", timezone: "UTC" }) }))).status).toBe(400);
    expect((await subscribe.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ subscription: sub, reminderTime: "19:00", timezone: "Asia/Kolkata" }) }))).status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ reminderTime: "19:00", timezone: "Asia/Kolkata", endpoint: sub.endpoint }));
    vi.doUnmock("@/lib/server/push/store");
  });
});
