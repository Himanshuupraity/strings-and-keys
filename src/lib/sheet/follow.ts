import { isStop, type SheetLine } from "./parse";

/**
 * "Follow my voice" — moves through the song sheet from the singer's phrasing, entirely on-device.
 * It does NOT recognise words: it detects when you start singing a line and when you pause after
 * it. Each finished phrase moves to the next line. Instrumental (chord-only) lines are skipped as
 * soon as you start singing again.
 */
export interface FollowerOptions {
  /** How much louder than the room your voice must be, as a ratio (2 ≈ +6 dB). */
  sensitivity: number;
  /** Shortest phrase that counts (ms) — ignores coughs and clicks. */
  minPhraseMs: number;
  /** Silence after a phrase before moving on (ms). */
  gapMs: number;
  /** Warm-up before the first decision (ms). */
  calibrateMs: number;
  /** Dips shorter than this between syllables don't break a phrase (ms). */
  bridgeMs: number;
  /** How far back the room's quiet level is remembered (ms). */
  floorWindowMs: number;
}

export const DEFAULT_FOLLOWER: FollowerOptions = { sensitivity: 2, minPhraseMs: 350, gapMs: 600, calibrateMs: 600, bridgeMs: 300, floorWindowMs: 8000 };

export type PhraseEvent = "calibrated" | "phrase-start" | "phrase-end";

const toDb = (level: number) => 20 * Math.log10(Math.max(level, 1e-5)); // floor at −100 dB
const fromDb = (db: number) => Math.pow(10, db / 20);
/** Absolute minimum voice level (−52 dB) so breathing in a silent room doesn't count. */
const MIN_VOICE_DB = -52;

/**
 * Relative (decibel) voice-activity detector. The room's quiet level is tracked continuously as
 * the minimum of short averages over the last few seconds, so it adapts to any microphone gain,
 * fan noise or video volume — no fixed calibration value to get wrong.
 */
export class PhraseFollower {
  private startedAt: number | null = null;
  private smooth = -100;
  private buckets: { t: number; min: number }[] = [];
  private voicedSince: number | null = null;
  private lastVoiced = -Infinity;
  private inPhrase = false;
  private calibrated = false;
  private lastDb = -100;

  constructor(private opts: FollowerOptions = DEFAULT_FOLLOWER) {}

  setOptions(patch: Partial<FollowerOptions>) {
    this.opts = { ...this.opts, ...patch };
  }

  get marginDb() {
    return 20 * Math.log10(Math.max(1.05, this.opts.sensitivity));
  }

  /** The room's quiet level (dB). */
  get floorDb() {
    return this.buckets.length ? Math.min(...this.buckets.map((b) => b.min)) : -100;
  }

  /** Current voice level above the room (dB) — shown in the UI to help troubleshooting. */
  get aboveFloorDb() {
    return this.lastDb - this.floorDb;
  }

  /** Level the voice must exceed (linear RMS) — for the meter's marker. */
  get threshold() {
    return fromDb(Math.max(MIN_VOICE_DB, this.floorDb + this.marginDb));
  }

  get isCalibrated() {
    return this.calibrated;
  }

  get singing() {
    return this.inPhrase;
  }

  phraseLength(now: number) {
    return this.inPhrase && this.voicedSince !== null ? now - this.voicedSince : 0;
  }

  /**
   * Feed one analysis frame. `level` is RMS 0..1; `clarity` (0..1) is how pitched the sound is —
   * sung and spoken vowels are pitched; fans and traffic are not.
   */
  push(level: number, clarity: number, now: number): PhraseEvent | null {
    if (this.startedAt === null) this.startedAt = now;
    const db = toDb(level);
    this.lastDb = db;
    // ~80 ms smoothing, then remember the quietest smoothed value per 250 ms bucket.
    this.smooth = this.smooth <= -99 ? db : this.smooth + (db - this.smooth) * 0.25;
    const bucketT = Math.floor(now / 250) * 250;
    const last = this.buckets[this.buckets.length - 1];
    if (last && last.t === bucketT) last.min = Math.min(last.min, this.smooth);
    else this.buckets.push({ t: bucketT, min: this.smooth });
    while (this.buckets.length && this.buckets[0].t < now - this.opts.floorWindowMs) this.buckets.shift();

    if (!this.calibrated) {
      if (now - this.startedAt >= this.opts.calibrateMs) {
        this.calibrated = true;
        return "calibrated";
      }
      return null;
    }

    const floor = this.floorDb;
    const margin = this.marginDb;
    const above = db - floor;
    const loudEnough = db > MIN_VOICE_DB;
    // Pitched sound (sung/spoken vowels) counts a little earlier than unpitched noise.
    const voiced = loudEnough && (above > margin || (clarity > 0.6 && above > margin * 0.6));
    if (voiced) {
      if (this.voicedSince === null || now - this.lastVoiced > this.opts.bridgeMs) this.voicedSince = now;
      this.lastVoiced = now;
      if (!this.inPhrase && now - this.voicedSince >= 120) {
        this.inPhrase = true;
        return "phrase-start";
      }
      return null;
    }
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
