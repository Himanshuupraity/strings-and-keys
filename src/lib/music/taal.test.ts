import { describe, expect, it } from "vitest";
import { GUITAR_STRUMS, PIANO_LEFT_HAND, TAAL_LIST, TAALS, bolVoice, khaliMatras, markAt, taliMatras, vibhagStarts } from "./taal";
import { TAAL_PATTERNS, ALL_RHYTHM_PATTERNS, patternHitTimes } from "@/components/practice/logic/rhythm";
import { TAAL_LESSONS } from "@/content/curriculum/taal";
import { getLesson, LESSONS } from "@/content/curriculum";

describe("taal definitions", () => {
  it.each(TAAL_LIST.map((t) => [t.name, t] as const))("%s is internally consistent", (_n, t) => {
    expect(t.bols).toHaveLength(t.matras);
    expect(t.vibhag.reduce((a, b) => a + b, 0)).toBe(t.matras);
    expect(t.marks).toHaveLength(t.vibhag.length);
  });
  it("Dadra: 6 matras, 3+3, sam 1, khali 4", () => {
    const d = TAALS.dadra;
    expect([d.matras, d.vibhag]).toEqual([6, [3, 3]]);
    expect(markAt(d, 0)).toBe("X");
    expect(khaliMatras(d)).toEqual([3]);
    expect(d.bols).toEqual(["Dha", "Dhi", "Na", "Dha", "Ti", "Na"]);
  });
  it("Keherwa: 8 matras, 4+4, sam 1, khali 5", () => {
    const k = TAALS.keherwa;
    expect(k.vibhag).toEqual([4, 4]);
    expect(markAt(k, 0)).toBe("X");
    expect(khaliMatras(k)).toEqual([4]);
    expect(k.bols.join(" ")).toBe("Dha Ge Na Ti Na Ka Dhi Na");
  });
  it("Rupak: 7 matras, 3+2+2, starts on khali with claps on 4 and 6", () => {
    const r = TAALS.rupak;
    expect(r.vibhag).toEqual([3, 2, 2]);
    expect(khaliMatras(r)).toEqual([0]);
    expect(taliMatras(r)).toEqual([3, 5]);
  });
  it("Teentaal: 16 matras, X 2 0 3 on 1, 5, 9, 13", () => {
    const t = TAALS.teentaal;
    expect(vibhagStarts(t)).toEqual([0, 4, 8, 12]);
    expect(t.marks).toEqual(["X", "2", "0", "3"]);
    expect(khaliMatras(t)).toEqual([8]);
  });
  it("strums and left-hand patterns fit their taal", () => {
    for (const [id, list] of Object.entries(GUITAR_STRUMS)) {
      for (const s of list!) {
        const n = TAALS[id as keyof typeof TAALS].matras;
        expect(s.pattern).toHaveLength(n);
        expect(s.hits).toEqual(s.pattern.flatMap((x, i) => (x === "-" ? [] : [i])));
      }
    }
    for (const [id, lh] of Object.entries(PIANO_LEFT_HAND)) expect(lh!.steps).toHaveLength(TAALS[id as keyof typeof TAALS].matras);
  });
  it("bol voices: Dha has bass + treble, Ge bass only, Na treble only", () => {
    expect(bolVoice("Dha")).toMatchObject({ high: true, low: true });
    expect(bolVoice("Ge")).toMatchObject({ high: false, low: true });
    expect(bolVoice("Na")).toMatchObject({ high: true, low: false });
  });
});

describe("taal rhythm patterns", () => {
  it("each pattern uses one beat per matra and stays inside the cycle", () => {
    for (const p of TAAL_PATTERNS) {
      expect(p.beatsPerBar).toBe(TAALS[p.taal!].matras);
      expect(p.hits.every((h) => Number.isInteger(h) && h >= 0 && h < p.beatsPerBar)).toBe(true);
    }
    expect(new Set(ALL_RHYTHM_PATTERNS.map((p) => p.id)).size).toBe(ALL_RHYTHM_PATTERNS.length);
  });
  it("Keherwa strum hit times at 120 matras/min", () => {
    const p = TAAL_PATTERNS.find((x) => x.id === "taal-keherwa-strum")!;
    expect(patternHitTimes(p, 0, 120).slice(0, 6)).toEqual([0, 1, 1.5, 2.5, 3, 3.5]);
  });
});

describe("taal lessons", () => {
  it("are registered, unique and well-formed", () => {
    const ids = TAAL_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of TAAL_LESSONS) {
      expect(getLesson(l.id)).toBeDefined();
      for (const p of l.prerequisites) expect(getLesson(p), `${l.id} → ${p}`).toBeDefined();
      for (const qq of l.quiz) expect(qq.answer).toBeLessThan(qq.options.length);
      expect(l.steps.some((s) => s.kind === "exercise" && s.mastery)).toBe(true);
      for (const s of l.steps) {
        if (s.kind !== "exercise") continue;
        const ex = s.exercise;
        if (ex.type === "tap-rhythm") expect(ex.pattern.every((h) => h >= 0 && h < ex.beatsPerBar)).toBe(true);
      }
    }
  });
});
