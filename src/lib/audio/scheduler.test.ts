import { describe, expect, it } from "vitest";
import { BeatScheduler, TapTempo, clampBpm, scoreTiming, type BeatEvent } from "./scheduler";

function fakeEnv() {
  let t = 0;
  let fn: (() => void) | null = null;
  return {
    clock: { now: () => t },
    setTimer: (f: () => void) => ((fn = f), 1),
    clearTimer: () => (fn = null),
    advance(sec: number, stepMs = 25) {
      const end = t + sec;
      while (t < end) {
        t = Math.min(end, t + stepMs / 1000 + Math.random() * 0.01); // jittery JS timer
        fn?.();
      }
    },
  };
}

describe("BeatScheduler", () => {
  it("schedules beats at exact times without drift despite timer jitter", () => {
    const env = fakeEnv();
    const events: BeatEvent[] = [];
    const s = new BeatScheduler(env.clock, { bpm: 120, beatsPerBar: 4, accentFirst: true, onSchedule: (e) => events.push(e), setTimer: env.setTimer, clearTimer: env.clearTimer });
    s.start(0);
    env.advance(60);
    expect(events.length).toBeGreaterThanOrEqual(120);
    events.forEach((e, i) => expect(e.time).toBeCloseTo(i * 0.5, 9));
    expect(events.filter((e) => e.accent).every((e) => e.beatInBar === 0)).toBe(true);
    expect(events[4].bar).toBe(1);
    s.stop();
    const n = events.length;
    env.advance(2);
    expect(events.length).toBe(n);
  });
  it("tempo change re-anchors without jumping", () => {
    const env = fakeEnv();
    const events: BeatEvent[] = [];
    const s = new BeatScheduler(env.clock, { bpm: 60, beatsPerBar: 4, accentFirst: false, onSchedule: (e) => events.push(e), setTimer: env.setTimer, clearTimer: env.clearTimer });
    s.start(0);
    env.advance(2.95);
    s.setBpm(120);
    env.advance(3);
    for (let i = 1; i < events.length; i++) {
      const d = events[i].time - events[i - 1].time;
      expect([1, 0.5].some((x) => Math.abs(x - d) < 1e-9)).toBe(true);
    }
  });
  it("clamps bpm to 40–240", () => {
    expect(clampBpm(10)).toBe(40);
    expect(clampBpm(400)).toBe(240);
  });
});

describe("tap tempo & timing", () => {
  it("computes bpm from taps", () => {
    const t = new TapTempo();
    [0, 500, 1000, 1500].forEach((ms, i) => {
      const r = t.tap(ms);
      if (i > 0) expect(r).toBe(120);
    });
  });
  it("scores early and late hits", () => {
    const r = scoreTiming([0, 500, 1000, 1500], [-60, 510, 1090, 3000]);
    expect(r.hitCount).toBe(3);
    expect(r.early).toBe(1);
    expect(r.late).toBe(1);
    expect(r.missed).toBe(1);
    expect(r.extra).toBe(1);
  });
});
