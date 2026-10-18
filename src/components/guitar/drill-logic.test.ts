import { describe, expect, it } from "vitest";
import {
  audioFrameTransition,
  chordMatches,
  createTimer,
  createTransitions,
  DRILL_PAIRS,
  elapsedMs,
  isPairUnlocked,
  isSupportedChord,
  manualConfirmTransition,
  pairKey,
  pauseTimer,
  personalBests,
  recommendPair,
  remainingMs,
  restartTimer,
  resumeTimer,
  selfReportTransition,
  startTimer,
  targetChord,
  tickTimer,
  unlockedTiers,
  weeklyStats,
  formatClock,
} from "./drill-logic";

describe("drill timer (elapsed-time based)", () => {
  it("counts down, pauses and resumes without drift", () => {
    let t = createTimer(60_000);
    t = startTimer(t, 1000);
    expect(remainingMs(t, 11_000)).toBe(50_000);
    t = pauseTimer(t, 11_000);
    expect(t.status).toBe("paused");
    // Time passing while paused doesn't count
    expect(remainingMs(t, 99_000)).toBe(50_000);
    t = resumeTimer(t, 100_000);
    expect(elapsedMs(t, 105_000)).toBe(15_000);
    expect(tickTimer(t, 149_999).status).toBe("running");
    t = tickTimer(t, 150_000);
    expect(t.status).toBe("finished");
    expect(remainingMs(t, 200_000)).toBe(0);
  });
  it("does not finish early, clamps at duration, and restarts", () => {
    let t = startTimer(createTimer(60_000), 0);
    expect(tickTimer(t, 59_999).status).toBe("running");
    expect(elapsedMs(t, 1e9)).toBe(60_000);
    t = restartTimer(t);
    expect(t.status).toBe("idle");
    expect(remainingMs(t, 5)).toBe(60_000);
  });
  it("formats the clock", () => {
    expect(formatClock(60_000)).toBe("1:00");
    expect(formatClock(9_100)).toBe("0:10");
    expect(formatClock(0)).toBe("0:00");
  });
});

describe("transition counting", () => {
  it("self-reported taps alternate the target", () => {
    let s = createTransitions(["G", "C"]);
    expect(targetChord(s)).toBe("C");
    s = selfReportTransition(s);
    expect(targetChord(s)).toBe("G");
    s = selfReportTransition(s);
    expect(s.count).toBe(2);
    expect(s.selfReported).toBe(2);
  });

  it("audio counts only stable, confident target-chord frames", () => {
    let s = createTransitions(["G", "C"]);
    const c = { best: "C", activePcs: [0, 4, 7], confidence: 0.8 };
    for (let i = 0; i < 3; i++) {
      const r = audioFrameTransition(s, c, { threshold: 0.5, stableNeeded: 4 });
      expect(r.counted).toBe(false);
      s = r.state;
    }
    const r = audioFrameTransition(s, c, { threshold: 0.5, stableNeeded: 4 });
    expect(r.counted).toBe(true);
    expect(r.state.byAudio).toBe(1);
    expect(targetChord(r.state)).toBe("G");
  });

  it("low confidence and ambiguous frames never count and reset stability", () => {
    let s = createTransitions(["G", "C"]);
    s = audioFrameTransition(s, { best: "C", activePcs: [0, 4, 7], confidence: 0.9 }, { threshold: 0.5, stableNeeded: 2 }).state;
    s = audioFrameTransition(s, { best: "C", activePcs: [0, 4, 7], confidence: 0.2 }, { threshold: 0.5, stableNeeded: 2 }).state;
    expect(s.stableFrames).toBe(0);
    const amb = audioFrameTransition(s, { best: "F#", activePcs: [6, 10, 1], confidence: 0.9 }, { threshold: 0.5, stableNeeded: 1 });
    expect(amb.counted).toBe(false);
    expect(amb.state.ambiguousFrames).toBe(2); // low-confidence frame + wrong chord
    expect(amb.state.count).toBe(0);
  });

  it("manual confirm is tracked separately", () => {
    const s = manualConfirmTransition(createTransitions(["Em", "Am"]));
    expect(s).toMatchObject({ count: 1, manual: 1, byAudio: 0 });
  });

  it("chordMatches uses chord tones with at most one extra", () => {
    expect(chordMatches("Em", { best: "G", activePcs: [4, 7, 11] })).toBe(true);
    expect(chordMatches("C", { best: null, activePcs: [0, 4, 7, 2] })).toBe(true);
    expect(chordMatches("C", { best: null, activePcs: [0, 4] })).toBe(false);
  });
});

describe("pairs, unlocking & recommendations", () => {
  it("every built-in drill chord has a diagram", () => {
    for (const p of DRILL_PAIRS) for (const c of p.pair) expect(isSupportedChord(c), c).toBe(true);
  });
  it("pair key is order-insensitive", () => {
    expect(pairKey(["G", "C"])).toBe(pairKey(["C", "G"]));
  });
  it("personal bests ignore untimed practice", () => {
    const b = personalBests([
      { pair: ["G", "C"], transitions: 20 },
      { pair: ["C", "G"], transitions: 31 },
      { pair: ["G", "C"], transitions: 99, untimed: true },
    ]);
    expect(b.get(pairKey(["G", "C"]))).toBe(31);
  });
  it("unlocks the next tier after two pairs reach 30", () => {
    const b = new Map<string, number>();
    expect(unlockedTiers(b)).toBe(0);
    expect(isPairUnlocked(["A", "D"], b)).toBe(false);
    b.set(pairKey(["Em", "Am"]), 30);
    b.set(pairKey(["G", "C"]), 35);
    expect(unlockedTiers(b)).toBe(1);
    expect(isPairUnlocked(["A", "D"], b)).toBe(true);
    expect(isPairUnlocked(["Bm", "G"], b)).toBe(false);
    expect(isPairUnlocked(["Cmaj7", "Fmaj7"], b)).toBe(true); // custom pair
  });
  it("recommends staying on a weak pair, then untried, then weakest", () => {
    const b = new Map<string, number>([[pairKey(["Em", "Am"]), 12]]);
    expect(recommendPair(b, ["Em", "Am"]).pair).toEqual(["Em", "Am"]);
    b.set(pairKey(["Em", "Am"]), 45);
    expect(recommendPair(b, ["Em", "Am"]).pair).toEqual(["Em", "G"]);
    expect(recommendPair(new Map()).pair).toEqual(["Em", "Am"]);
  });
  it("weekly stats only count the last 7 days", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    const w = weeklyStats(
      [
        { date: "2026-10-17T10:00:00Z", transitions: 20 },
        { date: "2026-10-01T10:00:00Z", transitions: 50 },
      ],
      now,
    );
    expect(w).toEqual({ drills: 1, transitions: 20 });
  });
});

describe("pair list", () => {
  it("has no duplicate pairs (order-insensitive)", () => {
    const keys = DRILL_PAIRS.map((p) => pairKey(p.pair));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
