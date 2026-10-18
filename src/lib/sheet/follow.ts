import { isStop, type SheetLine } from "./parse";

/**
 * "Follow my voice" — moves through the song sheet from the singer's phrasing, entirely on-device.
 * It does NOT recognise words: it detects when you start singing a line and when you pause after
 * it. Each finished phrase moves to the next line. Instrumental (chord-only) lines are skipped as
 * soon as you start singing again.
 */
export interface FollowerOptions {
  /** How far above the measured room noise counts as voice (multiplier). */
  sensitivity: number;
  /** Shortest phrase that counts (ms) — ignores coughs and clicks. */
  minPhraseMs: number;
  /** Silence after a phrase before moving on (ms). */
  gapMs: number;
  /** Time spent measuring room noise at the start (ms). */
  calibrateMs: number;
  /** Dips shorter than this between syllables don't break a phrase (ms). */
  bridgeMs: number;
}

export const DEFAULT_FOLLOWER: FollowerOptions = { sensitivity: 2.5, minPhraseMs: 400, gapMs: 600, calibrateMs: 1000, bridgeMs: 250 };

export type PhraseEvent = "calibrated" | "phrase-start" | "phrase-end";

/** Lowest threshold, so a very quiet room doesn't make breathing count as singing. */
const MIN_THRESHOLD = 0.006;

export class PhraseFollower {
  private calibration: number[] = [];
  private noise = 0;
  private startedAt: number | null = null;
  private voicedSince: number | null = null;
  private lastVoiced = -Infinity;
  private inPhrase = false;
  private calibrated = false;

  constructor(private opts: FollowerOptions = DEFAULT_FOLLOWER) {}

  setOptions(patch: Partial<FollowerOptions>) {
    this.opts = { ...this.opts, ...patch };
  }

  get threshold() {
    return Math.max(MIN_THRESHOLD, this.noise * this.opts.sensitivity);
  }

  get isCalibrated() {
    return this.calibrated;
  }

  get singing() {
    return this.inPhrase;
  }

  /** How long the current phrase has lasted (ms); a very long one usually means music in the room. */
  phraseLength(now: number) {
    return this.inPhrase && this.voicedSince !== null ? now - this.voicedSince : 0;
  }

  /**
   * Feed one analysis frame. `level` is RMS 0..1; `clarity` (0..1) is how pitched the sound is —
   * sung and spoken vowels are fairly pitched; fans and traffic are not.
   */
  push(level: number, clarity: number, now: number): PhraseEvent | null {
    if (this.startedAt === null) this.startedAt = now;
    if (!this.calibrated) {
      this.calibration.push(level);
      if (now - this.startedAt >= this.opts.calibrateMs) {
        // A low percentile, so starting to sing during calibration doesn't inflate the noise floor.
        const sorted = [...this.calibration].sort((a, b) => a - b);
        this.noise = Math.min(0.04, sorted[Math.floor(sorted.length * 0.3)] ?? 0);
        this.calibrated = true;
        return "calibrated";
      }
      return null;
    }
    const t = this.threshold;
    const voiced = level > t && (clarity > 0.45 || level > t * 1.6);
    if (voiced) {
      // Bridge the short dips between syllables: only a real gap restarts the phrase timer.
      if (this.voicedSince === null || now - this.lastVoiced > this.opts.bridgeMs) this.voicedSince = now;
      this.lastVoiced = now;
      if (!this.inPhrase && now - this.voicedSince >= 150) {
        this.inPhrase = true;
        return "phrase-start";
      }
      return null;
    }
    // Slowly follow changes in room noise while quiet.
    if (!this.inPhrase && level < t) this.noise = Math.min(0.04, this.noise * 0.995 + level * 0.005);
    if (this.inPhrase && now - this.lastVoiced >= this.opts.gapMs) {
      const length = this.lastVoiced - (this.voicedSince ?? this.lastVoiced);
      this.inPhrase = false;
      this.voicedSince = null;
      return length >= this.opts.minPhraseMs ? "phrase-end" : null;
    }
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
