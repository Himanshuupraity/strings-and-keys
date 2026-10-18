import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryAdapter } from "@/lib/storage/adapter";
import { setAdapter } from "@/lib/storage/db";
import { __resetPrefsCache } from "@/lib/storage/prefs";
import { practiceRepo } from "@/lib/storage/repositories";
import { __resetLearnerCache, getSyncStatus, loadLearner } from "./store";
import { __resetSyncCache, PinRequiredError, pushNow, reconcile, resumeAfterUnlock, selectLearner } from "./sync";
import { getToken, setToken, unlockLearner } from "./pin-client";

const ID = "7d3f7a52-2c58-4b2a-9d1b-6f1d2a9c1e11";
const bundle = { app: "melody-masters", version: 1, exportedAt: "2026-10-18T10:00:00Z", prefs: {}, collections: {} };

/** Fake server: profile protected by PIN "4321"; valid token is "good-token". */
function server() {
  const seen: { path: string; token: string | null }[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push({ path: url, token: headers.get("x-learner-token") });
    const method = init?.method ?? "GET";
    if (url === "/api/learners") return json(200, { enabled: true, pinSupported: true, learners: [{ id: ID, name: "Asha", updatedAt: "t", hasPin: true }] });
    if (url === `/api/learners/${ID}/unlock`) {
      const { pin } = JSON.parse(String(init?.body));
      return pin === "4321" ? json(200, { token: "good-token", hasPin: true }) : json(403, { error: "Wrong PIN.", attemptsLeft: 4 });
    }
    if (url === `/api/learners/${ID}`) {
      if (headers.get("x-learner-token") !== "good-token") return json(401, { pinRequired: true });
      if (method === "GET") return json(200, { learner: { id: ID, name: "Asha", updatedAt: "2026-10-18T10:00:00Z" }, data: bundle });
      return json(200, { updatedAt: "2026-10-18T11:00:00Z" });
    }
    return json(404, {});
  };
  return { seen, fetchImpl };
}

describe("PIN-protected sync", () => {
  let s: ReturnType<typeof server>;
  beforeEach(() => {
    localStorage.clear();
    __resetPrefsCache();
    __resetLearnerCache();
    __resetSyncCache();
    setAdapter(new MemoryAdapter());
    s = server();
    vi.stubGlobal("fetch", vi.fn((u: string, i?: RequestInit) => s.fetchImpl(u, i)));
  });

  it("opening a protected profile without a token asks for the PIN", async () => {
    await expect(selectLearner({ id: ID, name: "Asha", updatedAt: "t", hasPin: true })).rejects.toBeInstanceOf(PinRequiredError);
    expect(loadLearner()).toBeNull();
  });

  it("wrong PIN is reported; right PIN stores a token that is sent on every request", async () => {
    expect(await unlockLearner(ID, "0000")).toMatchObject({ ok: false, reason: "wrong", attemptsLeft: 4 });
    expect(await unlockLearner(ID, "4321")).toEqual({ ok: true });
    expect(getToken(ID)).toBe("good-token");
    await selectLearner({ id: ID, name: "Asha", updatedAt: "t", hasPin: true });
    expect(loadLearner()).toMatchObject({ id: ID, hasPin: true });
    await practiceRepo.add({ instrument: "guitar", activity: "x", startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationSec: 120 });
    await pushNow();
    const learnerCalls = s.seen.filter((c) => c.path === `/api/learners/${ID}`);
    expect(learnerCalls.length).toBeGreaterThanOrEqual(2);
    expect(learnerCalls.every((c) => c.token === "good-token")).toBe(true);
    expect(getSyncStatus().state).toBe("idle");
  });

  it("a stale token (PIN changed elsewhere) locks syncing but keeps local progress; unlocking resumes", async () => {
    await unlockLearner(ID, "4321");
    await selectLearner({ id: ID, name: "Asha", updatedAt: "t", hasPin: true });
    await practiceRepo.add({ instrument: "piano", activity: "kept", startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationSec: 300 });
    setToken(ID, "stale");
    await reconcile();
    expect(getSyncStatus().state).toBe("locked");
    expect(getToken(ID)).toBeNull();
    expect((await practiceRepo.list()).some((p) => p.activity === "kept")).toBe(true);
    await unlockLearner(ID, "4321");
    await resumeAfterUnlock();
    expect(getSyncStatus().state).not.toBe("locked");
  });
});
