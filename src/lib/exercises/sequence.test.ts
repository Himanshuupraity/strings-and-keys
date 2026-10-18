import { describe, expect, it } from "vitest";
import { findAllProgress, mistakeSummary, sequenceAccuracy, startSequence, stepSequence } from "./sequence";
import { midiToName } from "@/lib/music/notes";

describe("sequence exercise", () => {
  it("advances on correct notes and records mistakes", () => {
    let s = startSequence([60, 62, 64]);
    s = stepSequence(s, 60).state;
    const r = stepSequence(s, 63);
    expect(r.verdict).toBe("wrong");
    s = stepSequence(r.state, 62).state;
    s = stepSequence(s, 64).state;
    expect(s.done).toBe(true);
    expect(sequenceAccuracy(s)).toBeCloseTo(2 / 3);
    expect(mistakeSummary(s, (m) => midiToName(m))).toContain("1 semitone higher");
  });
  it("anyOctave matches pitch class", () => {
    const s = stepSequence(startSequence([60], true), 72);
    expect(s.verdict).toBe("correct");
  });
  it("find-all", () => {
    const r = findAllProgress([48, 50, 60, 62, 72], [48, 60, 62], 0);
    expect(r.found).toEqual([48, 60]);
    expect(r.done).toBe(false);
    expect(r.wrong).toEqual([62]);
  });
});
