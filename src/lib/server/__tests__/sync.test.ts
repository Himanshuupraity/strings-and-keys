// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canonical, emptyBundle, planSync, rowsToWrite, validateBundle } from "../db/sync-mapping";

const now = "2026-10-18T10:00:00.000Z";
const envelope = (collections: Record<string, { key: string; value: unknown }[]>) => ({ app: "melody-masters", version: 1, exportedAt: now, prefs: { theme: "dark" }, collections });
const drill = (id: string, transitions: number) => ({ key: id, value: { id, date: now, pair: ["G", "C"], durationSec: 60, transitions, mode: "self" } });

describe("bundle validation", () => {
  it("rejects envelopes that aren't Melody Masters backups", () => {
    expect(() => validateBundle({ app: "other", collections: {} })).toThrow();
    expect(() => validateBundle("nope")).toThrow();
  });
  it("keeps valid rows and reports invalid ones", () => {
    const v = validateBundle(
      envelope({
        chordDrills: [drill("a", 10), { key: "b", value: { id: "b", transitions: -1 } }],
        practiceSessions: [{ key: "wrong-key", value: { id: "p1", instrument: "guitar", activity: "x", startedAt: now, endedAt: now, durationSec: 60 } }],
        hacker: [{ key: "x", value: 1 }],
      }),
    );
    expect(v.bundle.chordDrills.map((r) => r.key)).toEqual(["a"]);
    expect(v.bundle.practiceSessions).toEqual([]);
    expect(v.rejected.map((r) => r.reason)).toEqual(["invalid value", 'key should be "p1"', "unknown collection"]);
    expect(v.prefs).toEqual({ theme: "dark" });
  });
  it("limits rows per collection", () => {
    const many = Array.from({ length: 5001 }, (_, i) => drill(`d${i}`, 1));
    expect(() => validateBundle(envelope({ chordDrills: many }))).toThrow(/Too many/);
  });
});

describe("sync planning", () => {
  it("canonical JSON ignores key order and undefined", () => {
    expect(canonical({ b: 1, a: { d: 2, c: undefined } })).toBe(canonical({ a: { d: 2 }, b: 1 }));
  });
  it("classifies new, identical and conflicting rows and never overwrites with keep-server", () => {
    const server = emptyBundle();
    server.chordDrills = [validateBundle(envelope({ chordDrills: [drill("same", 5)] })).bundle.chordDrills[0], validateBundle(envelope({ chordDrills: [drill("diff", 5)] })).bundle.chordDrills[0]];
    const upload = validateBundle(envelope({ chordDrills: [drill("same", 5), drill("diff", 9), drill("new", 1)] })).bundle;
    const plan = planSync(server, upload);
    expect(plan).toEqual({ added: 1, identical: 1, conflicts: [{ collection: "chordDrills", key: "diff" }] });
    expect(rowsToWrite(server, upload, "keep-server").chordDrills.map((r) => r.key)).toEqual(["new"]);
    expect(rowsToWrite(server, upload, "keep-uploaded").chordDrills.map((r) => r.key)).toEqual(["diff", "new"]);
  });
});
