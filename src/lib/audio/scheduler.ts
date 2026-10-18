/**
 * Drift-free beat scheduler ("look-ahead" pattern).
 * A coarse JS timer wakes up every `intervalMs` and schedules any beats falling inside the next
 * `lookahead` seconds using the precise audio clock. Beat times are computed from the start time
 * and beat index (never by accumulating intervals), so timing error does not build up.
 *
 * The clock and timer are injectable so this is unit-testable without real audio.
 */
export interface Clock {
  now(): number;
}

export interface BeatEvent {
  index: number;
  /** Beat within the bar, 0-based. */
  beatInBar: number;
  bar: number;
  time: number;
  accent: boolean;
}

export interface SchedulerOptions {
  bpm: number;
  beatsPerBar: number;
  accentFirst: boolean;
  /** Subdivisions per beat (1 = quarters, 2 = eighths). */
  subdivision?: number;
  lookahead?: number;
  intervalMs?: number;
  onSchedule: (e: BeatEvent) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export const MIN_BPM = 40;
export const MAX_BPM = 240;

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export class BeatScheduler {
  private startTime = 0;
  private nextIndex = 0;
  private timer: unknown = null;
  private opts: Required<Omit<SchedulerOptions, "setTimer" | "clearTimer">> & Pick<SchedulerOptions, "setTimer" | "clearTimer">;
  /** Time origin for index 0 after tempo changes. */
  private originIndex = 0;

  constructor(private clock: Clock, opts: SchedulerOptions) {
    this.opts = { subdivision: 1, lookahead: 0.12, intervalMs: 25, ...opts };
  }

  get running() {
    return this.timer !== null;
  }

  private beatDuration() {
    return 60 / this.opts.bpm / this.opts.subdivision;
  }

  timeOf(index: number): number {
    return this.startTime + (index - this.originIndex) * this.beatDuration();
  }

  start(delay = 0.05) {
    if (this.running) return;
    this.startTime = this.clock.now() + delay;
    this.nextIndex = 0;
    this.originIndex = 0;
    this.tick();
    const set = this.opts.setTimer ?? ((fn: () => void, ms: number) => setInterval(fn, ms));
    this.timer = set(() => this.tick(), this.opts.intervalMs);
  }

  stop() {
    if (this.timer !== null) (this.opts.clearTimer ?? ((id: unknown) => clearInterval(id as number)))(this.timer);
    this.timer = null;
  }

  /** Change tempo without a jump: re-anchor at the next unscheduled beat. */
  setBpm(bpm: number) {
    const nextTime = this.timeOf(this.nextIndex);
    this.opts.bpm = clampBpm(bpm);
    this.startTime = nextTime;
    this.originIndex = this.nextIndex;
  }

  setBeatsPerBar(n: number) {
    this.opts.beatsPerBar = n;
  }

  setAccent(a: boolean) {
    this.opts.accentFirst = a;
  }

  tick() {
    const horizon = this.clock.now() + this.opts.lookahead;
    while (this.timeOf(this.nextIndex) < horizon) {
      const i = this.nextIndex;
      const perBar = this.opts.beatsPerBar * this.opts.subdivision;
      const inBar = i % perBar;
      this.opts.onSchedule({
        index: i,
        beatInBar: Math.floor(inBar / this.opts.subdivision),
        bar: Math.floor(i / perBar),
        time: this.timeOf(i),
        accent: this.opts.accentFirst && inBar === 0,
      });
      this.nextIndex++;
    }
  }
}

/** Tap tempo: average of recent intervals, resetting after a long pause. */
export class TapTempo {
  private taps: number[] = [];
  tap(nowMs: number): number | null {
    if (this.taps.length && nowMs - this.taps[this.taps.length - 1] > 2000) this.taps = [];
    this.taps.push(nowMs);
    if (this.taps.length > 6) this.taps.shift();
    if (this.taps.length < 2) return null;
    const intervals = this.taps.slice(1).map((t, i) => t - this.taps[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return clampBpm(60000 / avg);
  }
  reset() {
    this.taps = [];
  }
}

/**
 * Compare taps against expected beat times. Returns per-hit offsets (ms; negative = early).
 * Each expected beat is matched with at most one tap within `windowMs`.
 */
export function scoreTiming(expected: number[], taps: number[], windowMs = 200) {
  const used = new Set<number>();
  const hits: { expected: number; tap: number | null; offsetMs: number | null }[] = expected.map((e) => {
    let best = -1;
    let bestD = Infinity;
    taps.forEach((t, i) => {
      if (used.has(i)) return;
      const d = Math.abs(t - e);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0 && bestD <= windowMs) {
      used.add(best);
      return { expected: e, tap: taps[best], offsetMs: taps[best] - e };
    }
    return { expected: e, tap: null, offsetMs: null };
  });
  const matched = hits.filter((h) => h.offsetMs !== null);
  const meanAbs = matched.length ? matched.reduce((a, h) => a + Math.abs(h.offsetMs!), 0) / matched.length : null;
  const extra = taps.length - used.size;
  return {
    hits,
    hitCount: matched.length,
    missed: expected.length - matched.length,
    extra,
    meanAbsMs: meanAbs,
    early: matched.filter((h) => h.offsetMs! < -40).length,
    late: matched.filter((h) => h.offsetMs! > 40).length,
    accuracy: expected.length ? Math.max(0, (matched.length - extra * 0.5) / expected.length) : 0,
  };
}
