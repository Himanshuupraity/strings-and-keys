import { beforeEach, describe, expect, it, vi } from "vitest";
import { LearnerNameSchema, cleanName, initials, nameKey } from "./names";
import { selectionAction, startupAction } from "./decide";
import { MemoryAdapter } from "@/lib/storage/adapter";
import { setAdapter } from "@/lib/storage/db";
import { __resetPrefsCache, loadPrefs, savePrefs } from "@/lib/storage/prefs";
import { drillRepo, practiceRepo, profileRepo } from "@/lib/storage/repositories";
import { __resetLearnerCache, loadLearner } from "./store";
import { __resetSyncCache, createLearner, fetchLearners, pushNow, reconcile, selectLearner, switchLearner } from "./sync";

describe("names", () => {
  it("cleans and keys names case-insensitively", () => {
    expect(cleanName("  Asha   Rao ")).toBe("Asha Rao");
    expect(nameKey(" ASHA ")).toBe(nameKey("asha"));
    expect(initials("asha rao")).toBe("AR");
    expect(LearnerNameSchema.safeParse("").success).toBe(false);
    expect(LearnerNameSchema.safeParse("x".repeat(41)).success).toBe(false);
    expect(LearnerNameSchema.safeParse("<script>").success).toBe(false);
    expect(LearnerNameSchema.parse(" Zoë O'Neil-Kumar ")).toBe("Zoë O'Neil-Kumar");
    expect(LearnerNameSchema.parse("प्रिया")).toBe("प्रिया");
  });
});

describe("sync decisions", () => {
  const t1 = "2026-10-18T10:00:00.000Z";
  const t2 = "2026-10-18T11:00:00.000Z";
  it("startup", () => {
    expect(startupAction({ remoteHasData: false, remoteUpdatedAt: t1, syncedAt: null, dirty: false, localHasData: true })).toBe("push");
    expect(startupAction({ remoteHasData: true, remoteUpdatedAt: t1, syncedAt: t1, dirty: false, localHasData: true })).toBe("nothing");
    expect(startupAction({ remoteHasData: true, remoteUpdatedAt: t1, syncedAt: t1, dirty: true, localHasData: true })).toBe("push");
    expect(startupAction({ remoteHasData: true, remoteUpdatedAt: t2, syncedAt: t1, dirty: false, localHasData: true })).toBe("replace-local");
    expect(startupAction({ remoteHasData: true, remoteUpdatedAt: t2, syncedAt: t1, dirty: true, localHasData: true })).toBe("merge-then-push");
    expect(startupAction({ remoteHasData: true, remoteUpdatedAt: t2, syncedAt: null, dirty: false, localHasData: false })).toBe("replace-local");
  });
  it("selection", () => {
    expect(selectionAction({ sameLearner: false, hadLearnerBefore: false, remoteHasData: true })).toBe("replace-local");
    expect(selectionAction({ sameLearner: false, hadLearnerBefore: true, remoteHasData: false })).toBe("clear-local");
    expect(selectionAction({ sameLearner: false, hadLearnerBefore: false, remoteHasData: false })).toBe("keep-local");
    expect(selectionAction({ sameLearner: true, hadLearnerBefore: true, remoteHasData: true })).toBe("keep-local");
  });
});

/* ---------- Fake /api/learners server (same contract as the route handlers) ---------- */

type Row = { id: string; name: string; key: string; data: unknown; updatedAt: string };
function fakeServer(enabled = true) {
  const rows = new Map<string, Row>();
  let clock = Date.parse("2026-10-18T10:00:00.000Z");
  const tick = () => new Date((clock += 1000)).toISOString();
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (!enabled) return json(url === "/api/learners" && method === "GET" ? 200 : 503, { enabled: false, learners: [] });
    if (url === "/api/learners" && method === "GET") return json(200, { enabled: true, learners: [...rows.values()].map(({ id, name, updatedAt }) => ({ id, name, updatedAt })) });
    if (url === "/api/learners" && method === "POST") {
      const key = nameKey(body.name);
      const found = [...rows.values()].find((r) => r.key === key);
      if (found) return json(200, { enabled: true, existed: true, learner: { id: found.id, name: found.name, updatedAt: found.updatedAt } });
      const r: Row = { id: crypto.randomUUID(), name: body.name, key, data: null, updatedAt: tick() };
      rows.set(r.id, r);
      return json(201, { enabled: true, existed: false, learner: { id: r.id, name: r.name, updatedAt: r.updatedAt } });
    }
    const id = url.split("/").pop()!;
    const row = rows.get(id);
    if (!row) return json(404, { error: "Unknown learner." });
    if (method === "GET") return json(200, { learner: { id, name: row.name, updatedAt: row.updatedAt }, data: row.data });
    if (method === "PUT") {
      if (!body.force && body.baseUpdatedAt && Date.parse(row.updatedAt) > Date.parse(body.baseUpdatedAt)) return json(409, { conflict: true, updatedAt: row.updatedAt });
      row.data = body.bundle;
      row.updatedAt = tick();
      return json(200, { updatedAt: row.updatedAt });
    }
    return json(405, {});
  };
  return { rows, fetchImpl };
}

/** Simulates opening the site on a different device: empty browser storage. */
async function newDevice() {
  localStorage.clear();
  __resetPrefsCache();
  __resetLearnerCache();
  setAdapter(new MemoryAdapter());
  __resetSyncCache();
}

const session = (activity: string) => ({ instrument: "guitar" as const, activity, startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationSec: 300 });

describe("learner profiles across devices", () => {
  let server: ReturnType<typeof fakeServer>;
  beforeEach(async () => {
    server = fakeServer();
    vi.stubGlobal("fetch", vi.fn((u: string, i?: RequestInit) => server.fetchImpl(u, i)));
    await newDevice();
  });

  it("name on device A → pick the name on device B → same progress", async () => {
    // Device A: practised a bit before typing a name; that progress is kept and uploaded.
    await practiceRepo.add(session("Before naming"));
    expect((await createLearner("Asha")).kind).toBe("created");
    await practiceRepo.add(session("Chord drill"));
    savePrefs({ instrument: "piano", onboarded: true });
    await pushNow();
    expect(loadLearner()?.dirty).toBe(false);

    // Device B
    await newDevice();
    const list = await fetchLearners();
    expect(list.enabled).toBe(true);
    expect(list.learners.map((l) => l.name)).toEqual(["Asha"]);
    await selectLearner(list.learners[0]);
    expect(loadLearner()?.name).toBe("Asha");
    expect((await practiceRepo.list()).map((s) => s.activity).sort()).toEqual(["Before naming", "Chord drill"]);
    expect((await profileRepo.get())?.name).toBe("Asha");
    expect(loadPrefs()).toMatchObject({ instrument: "piano", onboarded: true });
  });

  it("typing an existing name asks instead of overwriting", async () => {
    await createLearner("Asha");
    await newDevice();
    const r = await createLearner("  asha ");
    expect(r.kind).toBe("exists");
    expect(loadLearner()).toBeNull();
  });

  it("device A picks up device B's newer progress when it reopens", async () => {
    await createLearner("Asha");
    const deviceA = { id: loadLearner()!.id! };
    await newDevice();
    await selectLearner({ id: deviceA.id, name: "Asha", updatedAt: "" });
    await drillRepo.add({ pair: ["Em", "Am"], durationSec: 60, transitions: 25, mode: "self" });
    await pushNow();
    const fromB = server.rows.get(deviceA.id)!.data;

    // Back on device A (simulate its saved state: synced earlier, no local changes).
    await newDevice();
    localStorage.setItem("mm:learner", JSON.stringify({ id: deviceA.id, name: "Asha", syncedAt: "2026-10-18T10:00:01.000Z", dirty: false }));
    __resetLearnerCache();
    await reconcile();
    expect((await drillRepo.list())[0].transitions).toBe(25);
    expect(fromB).toBeTruthy();
  });

  it("changes on two devices are merged, never lost", async () => {
    await createLearner("Asha");
    const id = loadLearner()!.id!;
    const syncedAt = loadLearner()!.syncedAt;
    // Device B saves a drill.
    await newDevice();
    await selectLearner({ id, name: "Asha", updatedAt: "" });
    await drillRepo.add({ pair: ["G", "C"], durationSec: 60, transitions: 18, mode: "self" });
    await pushNow();
    // Device A (offline meanwhile) logged practice, then reconnects.
    await newDevice();
    localStorage.setItem("mm:learner", JSON.stringify({ id, name: "Asha", syncedAt, dirty: true }));
    __resetLearnerCache();
    await practiceRepo.add(session("Offline practice"));
    await reconcile();
    expect((await drillRepo.list()).length).toBe(1);
    expect((await practiceRepo.list()).some((s) => s.activity === "Offline practice")).toBe(true);
    // Server now has both
    const data = server.rows.get(id)!.data as { collections: Record<string, unknown[]> };
    expect(data.collections.chordDrills.length).toBe(1);
    expect(data.collections.practiceSessions.length).toBeGreaterThanOrEqual(1);
  });

  it("switching learner clears this device for the next person", async () => {
    await createLearner("Asha");
    await practiceRepo.add(session("Asha's practice"));
    expect((await switchLearner()).ok).toBe(true);
    expect(loadLearner()).toBeNull();
    expect(await practiceRepo.list()).toEqual([]);
    expect((await createLearner("Ravi")).kind).toBe("created");
    expect(await practiceRepo.list()).toEqual([]);
  });
});

describe("local-only mode (no Supabase)", () => {
  beforeEach(async () => {
    const server = fakeServer(false);
    vi.stubGlobal("fetch", vi.fn((u: string, i?: RequestInit) => server.fetchImpl(u, i)));
    await newDevice();
  });
  it("saves the name on this device and never wipes progress on rename", async () => {
    await practiceRepo.add(session("Local"));
    expect((await createLearner("Asha")).kind).toBe("local");
    expect(loadLearner()).toMatchObject({ id: null, name: "Asha" });
    await createLearner("Asha R");
    expect(await practiceRepo.list()).toHaveLength(1);
  });
});
