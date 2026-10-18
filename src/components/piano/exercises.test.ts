import { describe, expect, it } from "vitest";
import { KEYBOARD_PRESETS, SELECTABLE_SIZES } from "@/lib/music/keyboard";
import { chordPitchClasses } from "@/lib/music/chords";
import { mod12 } from "@/lib/music/notes";
import { ALANKARS } from "@/lib/music/sargam";
import { clefFor, focusWindow, PIANO_EXERCISES, resolveExercise, type Hand } from "./exercises";

const ranges = [
  ...SELECTABLE_SIZES.map((s) => ({ name: `${s} keys`, ...KEYBOARD_PRESETS[s] })),
  // Focused two-octave windows inside the 88-key range, including the extremes.
  ...[21, 36, 48, 60, 72, 84].map((start) => ({ name: `focus@${start}`, ...focusWindow(start, 21, 108) })),
];

describe("piano lab exercises", () => {
  it("ids are unique", () => {
    const ids = PIANO_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const r of ranges) {
    describe(r.name, () => {
      // Exact exercises (middle C) move the focus window instead of the notes — tested below.
      for (const def of PIANO_EXERCISES.filter((d) => !(d.kind === "sequence" && d.exact && r.name.startsWith("focus")))) {
        const hands: Hand[] = def.kind === "sequence" ? (Object.keys(def.variants) as Hand[]) : ["right"];
        const tonics = def.kind === "sargam" ? [0, 2, 7, 11] : [0];
        for (const hand of hands)
          for (const tonicPc of tonics)
            for (const alankar of def.kind === "sargam" ? ALANKARS.map((a) => a.id) : [undefined]) {
              it(`${def.id} (${hand}, Sa=${tonicPc}${alankar ? ", " + alankar : ""}) fits the visible keys`, () => {
                const res = resolveExercise(def, { low: r.low, high: r.high, hand, tonicPc, alankarId: alankar });
                const all = [...res.targets, ...(res.pool ?? [])];
                if (def.kind !== "find-all") expect(all.length).toBeGreaterThan(0);
                for (const m of all) {
                  expect(Number.isInteger(m)).toBe(true);
                  expect(m).toBeGreaterThanOrEqual(r.low);
                  expect(m).toBeLessThanOrEqual(r.high);
                }
                if (res.fingers) expect(res.fingers).toHaveLength(res.targets.length);
                if (res.durations) expect(res.durations).toHaveLength(res.targets.length);
                expect(Math.abs(res.shift % 12)).toBe(0);
              });
            }
      }
    });
  }

  it("fingers are 1–5", () => {
    for (const def of PIANO_EXERCISES) {
      if (def.kind !== "sequence") continue;
      for (const v of Object.values(def.variants)) for (const f of v?.fingers ?? []) expect(f >= 1 && f <= 5).toBe(true);
    }
  });

  it("middle C is never shifted", () => {
    const def = PIANO_EXERCISES.find((e) => e.id === "piano-find-middle-c")!;
    for (const s of SELECTABLE_SIZES) expect(resolveExercise(def, { ...KEYBOARD_PRESETS[s], hand: "right", tonicPc: 0 }).targets).toEqual([60]);
  });

  it("find every C lists exactly the visible Cs", () => {
    const def = PIANO_EXERCISES.find((e) => e.id === "piano-find-every-c")!;
    expect(resolveExercise(def, { ...KEYBOARD_PRESETS[88], hand: "right", tonicPc: 0 }).targets).toEqual([24, 36, 48, 60, 72, 84, 96, 108]);
    expect(resolveExercise(def, { ...KEYBOARD_PRESETS[49], hand: "right", tonicPc: 0 }).targets).toHaveLength(5);
  });

  it("triad notes are the chord tones", () => {
    const def = PIANO_EXERCISES.find((e) => e.kind === "chords")!;
    const res = resolveExercise(def, { ...KEYBOARD_PRESETS[61], hand: "right", tonicPc: 0 });
    for (const c of res.chords!) expect(c.notes.map(mod12).sort()).toEqual(chordPitchClasses(c.symbol).sort());
  });

  it("sargam starts on the chosen Sa", () => {
    const def = PIANO_EXERCISES.find((e) => e.kind === "sargam")!;
    const d = resolveExercise(def, { ...KEYBOARD_PRESETS[61], hand: "right", tonicPc: 2 });
    expect(mod12(d.targets[0])).toBe(2);
    expect(d.targets.slice(0, 8).map((m) => m - d.targets[0])).toEqual([0, 2, 4, 5, 7, 9, 11, 12]);
  });

  it("focus window and clef helpers", () => {
    expect(focusWindow(100, 21, 108)).toEqual({ low: 84, high: 108 });
    expect(focusWindow(10, 36, 84)).toEqual({ low: 36, high: 60 });
    expect(clefFor([48, 50, 52])).toBe("bass");
    expect(clefFor([60, 64, 67])).toBe("treble");
  });
});
