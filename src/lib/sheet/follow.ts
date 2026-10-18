import { isStop, type SheetLine } from "./parse";

/**
 * "Follow my voice" — moves through the song sheet from the singer's phrasing, entirely on-device.
 * It does NOT recognise words: it detects when you start singing a line and when you pause after
 * it. Each finished phrase moves to the next line. Instrumental (chord-only) lines are skipped as
 * soon as you start singing again.
 */
export interface FollowerOptions {
  /** How far above the measured room noise counts as singing (multiplier). */
  sensitivity: number;
  /** Shortest sung phrase that counts (ms) — ignores coughs and clicks. */
  minPhraseMs: number;
  /** Silence after a phrase before moving on (ms). */
  gapMs: number;
  /** Time spent measuring room noise at the start (ms). */
  calibrateMs: number;
}

export const DEFAULT_FOLLOWER: FollowerOptions = { sensitivity: 3, minPhraseMs: 450, gapMs: 650, calibrateMs: 1200 };

export type PhraseEvent = "calibrated" | "phrase-start" | "phrase-end";

export class PhraseFollower {
  private noise = 0;
  private noiseSamples = 0;
  private startedAt: number | null = null;
  private voicedSince: number | null = null;
  private lastVoiced = 0;
  private inPhrase = false;
  private calibrated = false;

  constructor(private opts: FollowerOptions = DEFAULT_FOLLOWER) {}

  setOptions(patch: Partial<FollowerOptions>) {
    this.opts = { ...this.opts, ...patch };
  }

  get threshold() {
    return Math.max(0.012, this.noise * this.opts.sensitivity);
  }

  get isCalibrated() {
    return this.calibrated;
  }

  get singing() {
    return this.inPhrase;
  }

  /**
   * Feed one analysis frame. `level` is RMS 0..1; `pitched` is true when a clear pitch was found
   * (voice or instrument), which helps reject broadband noise.
   */
  push(level: number, pitched: boolean, now: number): PhraseEvent | null {
    if (this.startedAt === null) this.startedAt = now;
    if (!this.calibrated) {
      this.noise = (this.noise * this.noiseSamples + level) / (this.noiseSamples + 1);
      this.noiseSamples++;
      if (now - this.startedAt >= this.opts.calibrateMs) {
        this.calibrated = true;
        return "calibrated";
      }
      return null;
    }
    const voiced = level > this.threshold && (pitched || level > this.threshold * 2);
    if (voiced) {
      this.lastVoiced = now;
      if (this.voicedSince === null) this.voicedSince = now;
      if (!this.inPhrase && now - this.voicedSince >= 120) {
        this.inPhrase = true;
        return "phrase-start";
      }
      return null;
    }
    // Slowly adapt to room noise while quiet.
    if (!this.inPhrase && level < this.threshold) this.noise = this.noise * 0.995 + level * 0.005;
    if (this.inPhrase && now - this.lastVoiced >= this.opts.gapMs) {
      const length = this.lastVoiced - (this.voicedSince ?? this.lastVoiced);
      this.inPhrase = false;
      this.voicedSince = null;
      return length >= this.opts.minPhraseMs ? "phrase-end" : null;
    }
    if (!this.inPhrase) this.voicedSince = null;
    return null;
  }
}

export function nextStop(lines: SheetLine[], from: number): number {
  for (let i = from + 1; i < lines.length; i++) if (isStop(lines[i])) return i;
  return from;
}

export function prevStop(lines: SheetLine[], from: number): number {
  for (let i = from - 1; i >= 0; i--) if (isStop(lines[i])) return i;
  return from;
}

export function firstStop(lines: SheetLine[]): number {
  const i = lines.findIndex(isStop);
  return i === -1 ? 0 : i;
}

/**
 * Where to go on a phrase event:
 *  - phrase-end on a lyric line → next stop (you finished singing it)
 *  - phrase-start while on an instrumental chord line → next lyric line (you started singing again)
 */
export function advanceOn(lines: SheetLine[], current: number, ev: PhraseEvent): number {
  const line = lines[current];
  if (ev === "phrase-end" && line?.kind === "lyric") return nextStop(lines, current);
  if (ev === "phrase-start" && line?.kind === "chords") {
    for (let i = current + 1; i < lines.length; i++) if (lines[i].kind === "lyric") return i;
  }
  return current;
}
