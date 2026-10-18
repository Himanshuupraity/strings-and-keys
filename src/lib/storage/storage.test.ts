import { beforeEach, describe, expect, it, vi } from "vitest";
import { IndexedDBAdapter, LocalStorageAdapter, MemoryAdapter, ResilientAdapter, StorageError, type StorageAdapter } from "./adapter";
import { setAdapter } from "./db";
import { applyImport, drillRepo, exportAll, planImport, practiceRepo, progressRepo } from "./repositories";
import { __resetPrefsCache, loadPrefs, savePrefs } from "./prefs";
import type { Lesson } from "@/content/types";

const lesson: Lesson = {
  id: "test-lesson", track: "piano", level: 0, order: 1, title: "T", summary: "", minutes: 5, skills: ["s"], prerequisites: [],
  steps: [
    { id: "a", kind: "explain", title: "", body: "" },
    { id: "b", kind: "exercise", title: "", body: "", exercise: { type: "find-all", instrument: "piano", pitchClass: 0, prompt: "" }, mastery: true, passAccuracy: 0.8 },
  ],
  quiz: [{ id: "q", question: "", options: ["x", "y"], answer: 0, explanation: "" }],
  passScore: 1, topics: [],
};

async function contract(make: () => StorageAdapter) {
  const a = make();
  await a.set("goals", "k", { v: 1 });
  expect(await a.get("goals", "k")).toEqual({ v: 1 });
  await a.update<{ v: number }>("goals", "k", (p) => ({ v: (p?.v ?? 0) + 1 }));
  expect(await a.get("goals", "k")).toEqual({ v: 2 });
  await a.set("goals", "k2", { v: 3 });
  await a.set("profile", "x", 1);
  expect((await a.list("goals")).map((r) => r.key).sort()).toEqual(["k", "k2"]);
  await a.remove("goals", "k");
  expect(await a.get("goals", "k")).toBeUndefined();
  await a.clear("goals");
  expect(await a.list("goals")).toEqual([]);
  expect(await a.get("profile", "x")).toBe(1);
}

describe("storage adapters share one contract", () => {
  it("memory", () => contract(() => new MemoryAdapter()));
  it("localStorage", () => contract(() => new LocalStorageAdapter()));
  it("indexedDB", () => contract(() => new IndexedDBAdapter()));
});

describe("resilience", () => {
  it("malformed localStorage JSON reads as missing", async () => {
    localStorage.setItem("mm:goals:bad", "{not json");
    expect(await new LocalStorageAdapter().get("goals", "bad")).toBeUndefined();
  });
  it("falls back to memory when the primary store fails", async () => {
    const broken: StorageAdapter = {
      kind: "localStorage",
      get: () => Promise.reject(new Error("blocked")),
      set: () => Promise.reject(new Error("blocked")),
      update: () => Promise.reject(new Error("blocked")),
      remove: () => Promise.reject(new Error("blocked")),
      list: () => Promise.reject(new Error("blocked")),
      clear: () => Promise.reject(new Error("blocked")),
    };
    const onError = vi.fn();
    const r = new ResilientAdapter(broken, onError);
    await r.set("goals", "a", 1);
    expect(await r.get("goals", "a")).toBe(1);
    expect(r.degraded).toBe(true);
    expect(onError).toHaveBeenCalled();
  });
  it("quota errors are surfaced as StorageError with quota flag", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await expect(new LocalStorageAdapter().set("goals", "a", 1)).rejects.toMatchObject({ quota: true });
    spy.mockRestore();
    expect(new StorageError("x")).toBeInstanceOf(Error);
  });
});

describe("prefs persist across reloads", () => {
  beforeEach(() => __resetPrefsCache());
  it("saves and reloads instrument, theme, tonic, label mode, keyboard size", () => {
    savePrefs({ instrument: "piano", theme: "dark", tonicPc: 2, labelMode: "both", keyboardSize: 88 });
    __resetPrefsCache(); // simulate page refresh
    expect(loadPrefs()).toMatchObject({ instrument: "piano", theme: "dark", tonicPc: 2, labelMode: "both", keyboardSize: 88 });
  });
  it("invalid stored values fall back to defaults field-by-field", () => {
    localStorage.setItem("mm:prefs", JSON.stringify({ instrument: "banjo", keyboardSize: 77, theme: "dark" }));
    const p = loadPrefs();
    expect(p.instrument).toBe("guitar");
    expect(p.keyboardSize).toBe(61);
    expect(p.theme).toBe("dark");
  });
});

describe("repositories (adapter-agnostic)", () => {
  beforeEach(() => setAdapter(new MemoryAdapter()));

  it("lesson completion requires steps + quiz; mastery requires measured exercise", async () => {
    let p = await progressRepo.open(lesson);
    expect(p.status).toBe("in-progress");
    p = await progressRepo.completeStep(lesson, "a");
    p = await progressRepo.recordExercise(lesson, "b", 0.5, true);
    expect(p.status).toBe("in-progress"); // quiz not passed
    p = await progressRepo.recordQuiz(lesson, 1, 1, []);
    expect(p.status).toBe("completed");
    p = await progressRepo.recordExercise(lesson, "b", 0.9, true);
    expect(p.status).toBe("mastered");
  });

  it("practice sessions and chord drills persist and survive an adapter swap via export/import", async () => {
    await practiceRepo.add({ instrument: "guitar", activity: "Test", startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationSec: 120 });
    await drillRepo.add({ pair: ["Em", "Am"], durationSec: 60, transitions: 22, mode: "self" });
    const bundle = await exportAll();
    setAdapter(new MemoryAdapter());
    expect(await practiceRepo.list()).toHaveLength(0);
    const plan = await planImport(bundle);
    expect(plan.added).toBe(2);
    await applyImport(bundle, "keep-local");
    expect(await practiceRepo.list()).toHaveLength(1);
    expect((await drillRepo.list())[0].transitions).toBe(22);
  });

  it("import never overwrites local data unless asked", async () => {
    await drillRepo.add({ pair: ["G", "C"], durationSec: 60, transitions: 10, mode: "self" });
    const bundle = await exportAll();
    const key = bundle.collections.chordDrills[0].key;
    (bundle.collections.chordDrills[0].value as { transitions: number }).transitions = 99;
    const plan = await planImport(bundle);
    expect(plan.conflicts).toEqual([{ collection: "chordDrills", key }]);
    await applyImport(bundle, "keep-local");
    expect((await drillRepo.list())[0].transitions).toBe(10);
    await applyImport(bundle, "keep-imported");
    expect((await drillRepo.list())[0].transitions).toBe(99);
  });

  it("drops malformed rows instead of crashing", async () => {
    const a = new MemoryAdapter();
    setAdapter(a);
    await a.set("practiceSessions", "junk", { nope: true });
    expect(await practiceRepo.list()).toEqual([]);
  });
});
