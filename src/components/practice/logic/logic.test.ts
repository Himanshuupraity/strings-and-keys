import { describe, expect, it } from "vitest";
import { classifyCents, centsFromTarget, nearestString, needleAngle, tuningAdvice } from "./tuner";
import { patternHitTimes, patternDuration, RHYTHM_PATTERNS, rhythmFeedback } from "./rhythm";
import { makeQuestion, seededRng, swaraQuestion, intervalQuestion, type EarMode } from "./ear";
import { STANDARD_TUNING } from "@/lib/music/guitar";
import { midiToFrequency } from "@/lib/music/notes";
import { SWARAS } from "@/lib/music/sargam";

describe("tuner logic", () => {
  it("auto-selects the nearest string", () => {
    expect(nearestString(82.4, STANDARD_TUNING)).toBe(0);
    expect(nearestString(110, STANDARD_TUNING)).toBe(1);
    expect(nearestString(196, STANDARD_TUNING)).toBe(3);
    expect(nearestString(250, STANDARD_TUNING)).toBe(4);
    expect(nearestString(330, STANDARD_TUNING)).toBe(5);
  });
  it("classifies cents", () => {
    expect(classifyCents(4.9)).toBe("in-tune");
    expect(classifyCents(-5)).toBe("in-tune");
    expect(classifyCents(-6)).toBe("flat");
    expect(classifyCents(12)).toBe("sharp");
    expect(tuningAdvice(-20)).toMatch(/Tighten/);
    expect(tuningAdvice(30)).toMatch(/Loosen/);
  });
  it("measures cents against the target and respects A4", () => {
    expect(centsFromTarget(midiToFrequency(40), 40)).toBeCloseTo(0);
    expect(centsFromTarget(midiToFrequency(40, 432), 40, 432)).toBeCloseTo(0);
    expect(centsFromTarget(midiToFrequency(40.1), 40)).toBeCloseTo(10);
  });
  it("needle clamps", () => {
    expect(needleAngle(100)).toBe(60);
    expect(needleAngle(-25)).toBe(-30);
  });
});

describe("rhythm patterns", () => {
  it("computes hit times across bars", () => {
    const q = RHYTHM_PATTERNS.find((p) => p.id === "quarters")!;
    expect(patternHitTimes(q, 10, 60)).toEqual([10, 11, 12, 13, 14, 15, 16, 17]);
    const e = RHYTHM_PATTERNS.find((p) => p.id === "eighths")!;
    expect(patternHitTimes(e, 0, 120).slice(0, 3)).toEqual([0, 0.25, 0.5]);
    expect(patternDuration(q, 60)).toBe(8);
  });
  it("hits are inside the bar and sorted", () => {
    for (const p of RHYTHM_PATTERNS) {
      expect(p.hits.every((h) => h >= 0 && h < p.beatsPerBar)).toBe(true);
      expect([...p.hits].sort((a, b) => a - b)).toEqual(p.hits);
    }
  });
  it("feedback mentions rushing", () => {
    expect(rhythmFeedback({ hitCount: 4, missed: 0, extra: 0, early: 3, late: 0, meanAbsMs: 60 }, 4)).toMatch(/rush/);
  });
});

describe("ear training questions", () => {
  const modes: EarMode[] = ["high-low", "match-note", "major-minor", "interval", "melody", "scale-note", "swara"];
  it("every question's answer is among the options (or answer notes given)", () => {
    const rng = seededRng(42);
    for (let i = 0; i < 200; i++) {
      const q = makeQuestion(modes[i % modes.length], rng, i % 12, 1 + (i % 3));
      if (q.options.length) expect(q.options).toContain(q.answer);
      else expect(q.answerNotes?.length).toBeGreaterThan(0);
      expect(q.play.length).toBeGreaterThan(0);
    }
  });
  it("swara questions are relative to the chosen Sa", () => {
    const rng = seededRng(7);
    for (let i = 0; i < 50; i++) {
      const q = swaraQuestion(rng, 2);
      const [sa, n] = q.play[0].notes;
      expect(sa % 12).toBe(2);
      expect(SWARAS[(n - sa) % 12].full).toBe(q.answer);
    }
  });
  it("interval answer matches the semitone distance", () => {
    const rng = seededRng(3);
    const q = intervalQuestion(rng);
    const [a, b] = q.play[0].notes;
    expect(q.explanation).toContain(`${b - a} semitones`);
  });
});

import { scaleRun, timingEvenness } from "./scale-run";
describe("scale trainer logic", () => {
  it("builds guitar runs on playable pitches and up-down runs", () => {
    const g = scaleRun("C", "major", "guitar", "up");
    expect(g[0]).toBe(48);
    expect(scaleRun("E", "minorPentatonic", "guitar", "up")[0]).toBe(40);
    const p = scaleRun("C", "major", "piano", "up-down");
    expect(p).toEqual([60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60]);
  });
  it("measures evenness", () => {
    const e = timingEvenness([0, 500, 1000, 1500], 500)!;
    expect(e.sd).toBe(0);
    expect(e.meanErr).toBe(0);
    expect(timingEvenness([0, 100])).toBeNull();
  });
});

import { elapsedMs, formatDuration, pauseTimer, resumeTimer, startTimer } from "./timer";
describe("practice timer", () => {
  it("accumulates only running time", () => {
    let s = startTimer(0);
    expect(elapsedMs(s, 10_000)).toBe(10_000);
    s = pauseTimer(s, 10_000);
    expect(elapsedMs(s, 60_000)).toBe(10_000);
    s = resumeTimer(s, 60_000);
    expect(elapsedMs(s, 65_000)).toBe(15_000);
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
  });
});
