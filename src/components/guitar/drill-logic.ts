import { chordPitchClasses, parseChord, shapesForChord } from "@/lib/music/chords";
import { mod12 } from "@/lib/music/notes";
import type { ChordDrillResult } from "@/lib/storage/schemas";

/* ------------------------------------------------------------------ */
/* Countdown timer — elapsed-time based (never accumulates intervals)  */
/* ------------------------------------------------------------------ */

export type TimerStatus = "idle" | "running" | "paused" | "finished";

export interface DrillTimer {
  status: TimerStatus;
  /** performance.now() when the current running segment began */
  segmentStart: number | null;
  /** ms accumulated over previous running segments */
  accumulated: number;
  durationMs: number;
}

export function createTimer(durationMs = 60_000): DrillTimer {
  return { status: "idle", segmentStart: null, accumulated: 0, durationMs };
}

export function elapsedMs(t: DrillTimer, now: number): number {
  const live = t.status === "running" && t.segmentStart !== null ? now - t.segmentStart : 0;
  return Math.min(t.durationMs, t.accumulated + live);
}

export function remainingMs(t: DrillTimer, now: number): number {
  return Math.max(0, t.durationMs - elapsedMs(t, now));
}

export function startTimer(t: DrillTimer, now: number): DrillTimer {
  if (t.status === "running") return t;
  if (t.status === "finished") return { ...createTimer(t.durationMs), status: "running", segmentStart: now };
  return { ...t, status: "running", segmentStart: now };
}

export function pauseTimer(t: DrillTimer, now: number): DrillTimer {
  if (t.status !== "running") return t;
  return { ...t, status: "paused", accumulated: elapsedMs(t, now), segmentStart: null };
}

export const resumeTimer = startTimer;

export function restartTimer(t: DrillTimer): DrillTimer {
  return createTimer(t.durationMs);
}

/** Call on every animation frame; flips to finished when time is up. */
export function tickTimer(t: DrillTimer, now: number): DrillTimer {
  if (t.status === "running" && remainingMs(t, now) <= 0) {
    return { ...t, status: "finished", accumulated: t.durationMs, segmentStart: null };
  }
  return t;
}

/* ------------------------------------------------------------------ */
/* Transition counting                                                 */
/* ------------------------------------------------------------------ */

export interface TransitionState {
  pair: [string, string];
  /** Index of the chord the student is currently holding. The target is the other one. */
  holding: 0 | 1;
  count: number;
  byAudio: number;
  manual: number;
  selfReported: number;
  /** Consecutive confident frames matching the target chord */
  stableFrames: number;
  /** Frames where audio was present but did not clearly match either chord */
  ambiguousFrames: number;
}

export function createTransitions(pair: [string, string]): TransitionState {
  return { pair, holding: 0, count: 0, byAudio: 0, manual: 0, selfReported: 0, stableFrames: 0, ambiguousFrames: 0 };
}

export function targetChord(s: TransitionState): string {
  return s.pair[s.holding === 0 ? 1 : 0];
}

export function currentChord(s: TransitionState): string {
  return s.pair[s.holding];
}

const flip = (h: 0 | 1): 0 | 1 => (h === 0 ? 1 : 0);

/** Mode 1: the student taps after each completed change. */
export function selfReportTransition(s: TransitionState): TransitionState {
  return { ...s, holding: flip(s.holding), count: s.count + 1, selfReported: s.selfReported + 1, stableFrames: 0 };
}

/** Mode 2 fallback: student confirms a change that the audio could not verify. */
export function manualConfirmTransition(s: TransitionState): TransitionState {
  return { ...s, holding: flip(s.holding), count: s.count + 1, manual: s.manual + 1, stableFrames: 0 };
}

export interface AudioChordFrame {
  best: string | null;
  activePcs: number[];
  confidence: number;
}

/**
 * Does an audio estimate match the expected chord? Requires the expected chord's full pitch-class
 * set and at most one extra pitch class, OR the top guess to be the same chord.
 */
export function chordMatches(expected: string, frame: Pick<AudioChordFrame, "best" | "activePcs">): boolean {
  const exp = parseChord(expected);
  if (!exp) return false;
  if (frame.best) {
    const b = parseChord(frame.best);
    if (b && b.rootPc === exp.rootPc && b.suffix === exp.suffix) return true;
  }
  const tones = chordPitchClasses(expected);
  const set = new Set(frame.activePcs.map(mod12));
  const allPresent = tones.every((t) => set.has(t));
  const extras = [...set].filter((p) => !tones.includes(p)).length;
  return allPresent && extras <= 1 && frame.activePcs.length > 0;
}

export interface AudioOptions {
  threshold: number;
  stableNeeded: number;
}

export const DEFAULT_AUDIO_OPTIONS: AudioOptions = { threshold: 0.45, stableNeeded: 4 };

/**
 * Mode 2: feed chroma frames. A transition is counted only when the TARGET chord is detected with
 * confidence ≥ threshold for `stableNeeded` consecutive frames. Ambiguous/noisy frames never count.
 */
export function audioFrameTransition(s: TransitionState, f: AudioChordFrame, opts: AudioOptions = DEFAULT_AUDIO_OPTIONS): { state: TransitionState; counted: boolean } {
  if (!f.best || f.confidence < opts.threshold) {
    return { state: { ...s, stableFrames: 0, ambiguousFrames: f.best ? s.ambiguousFrames + 1 : s.ambiguousFrames }, counted: false };
  }
  const target = targetChord(s);
  if (chordMatches(target, f)) {
    const stableFrames = s.stableFrames + 1;
    if (stableFrames >= opts.stableNeeded) {
      return { state: { ...s, holding: flip(s.holding), count: s.count + 1, byAudio: s.byAudio + 1, stableFrames: 0 }, counted: true };
    }
    return { state: { ...s, stableFrames }, counted: false };
  }
  if (chordMatches(currentChord(s), f)) return { state: { ...s, stableFrames: 0 }, counted: false };
  return { state: { ...s, stableFrames: 0, ambiguousFrames: s.ambiguousFrames + 1 }, counted: false };
}

/* ------------------------------------------------------------------ */
/* Pairs, personal bests, unlocking and recommendation                */
/* ------------------------------------------------------------------ */

export interface DrillPair {
  pair: [string, string];
  tier: number;
}

export const PAIR_TIERS: [string, string][][] = [
  [["Em", "Am"], ["Em", "G"], ["G", "C"], ["C", "Am"]],
  [["A", "D"], ["D", "G"], ["Am", "E"], ["Am", "Dm"], ["G", "Am"], ["D", "Em"]],
  [["C", "F"], ["Dm", "G"], ["E", "A"], ["Am", "F"], ["A7", "D"], ["E7", "A"]],
  [["Bm", "G"], ["Bm", "A"], ["F#m", "D"], ["Bb", "F"]],
];

export const TIER_NAMES = ["Beginner basics", "Common open chords", "Small barre & sevenths", "Barre chords"];

export const DRILL_PAIRS: DrillPair[] = PAIR_TIERS.flatMap((pairs, tier) => pairs.map((pair) => ({ pair, tier })));

/** Score needed on a pair before it counts towards unlocking the next tier. */
export const UNLOCK_SCORE = 30;
/** Pairs per tier that need UNLOCK_SCORE to unlock the next tier. */
export const UNLOCK_PAIRS_NEEDED = 2;

export function pairKey(pair: readonly [string, string] | readonly string[]): string {
  return [...pair].sort().join("|");
}

export function isSupportedChord(symbol: string): boolean {
  return shapesForChord(symbol).length > 0;
}

/** Best timed transition count per pair (untimed practice excluded). */
export function personalBests(results: Pick<ChordDrillResult, "pair" | "transitions" | "untimed">[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of results) {
    if (r.untimed) continue;
    const k = pairKey(r.pair);
    m.set(k, Math.max(m.get(k) ?? 0, r.transitions));
  }
  return m;
}

export function unlockedTiers(bests: Map<string, number>): number {
  let tier = 0;
  while (tier < PAIR_TIERS.length - 1) {
    const passed = PAIR_TIERS[tier].filter((p) => (bests.get(pairKey(p)) ?? 0) >= UNLOCK_SCORE).length;
    if (passed >= UNLOCK_PAIRS_NEEDED) tier++;
    else break;
  }
  return tier;
}

export function isPairUnlocked(pair: [string, string], bests: Map<string, number>): boolean {
  const entry = DRILL_PAIRS.find((p) => pairKey(p.pair) === pairKey(pair));
  if (!entry) return true; // custom pairs are always free practice
  return entry.tier <= unlockedTiers(bests);
}

/**
 * Recommend the next pair: if the current pair is going well (≥ 40), move to the first untried
 * unlocked pair; otherwise suggest the weakest tried pair (practise the weakest transition).
 */
export function recommendPair(bests: Map<string, number>, current?: [string, string]): { pair: [string, string]; reason: string } {
  const unlocked = DRILL_PAIRS.filter((p) => p.tier <= unlockedTiers(bests));
  const untried = unlocked.find((p) => !bests.has(pairKey(p.pair)) && (!current || pairKey(p.pair) !== pairKey(current)));
  const currentBest = current ? (bests.get(pairKey(current)) ?? 0) : 0;
  if (current && currentBest < 40 && bests.has(pairKey(current))) {
    return { pair: current, reason: "Stay with this pair a little longer — aim for clean changes before speed." };
  }
  if (untried) return { pair: untried.pair, reason: "You haven't tried this pair yet and it's unlocked for you." };
  const tried = unlocked
    .filter((p) => bests.has(pairKey(p.pair)))
    .sort((a, b) => (bests.get(pairKey(a.pair)) ?? 0) - (bests.get(pairKey(b.pair)) ?? 0));
  if (tried.length) return { pair: tried[0].pair, reason: "This is your weakest change right now — practising it separately helps the most." };
  return { pair: DRILL_PAIRS[0].pair, reason: "A gentle place to start: only two-finger chords." };
}

export function weeklyStats(results: Pick<ChordDrillResult, "date" | "transitions" | "untimed">[], now = new Date()) {
  const weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  const recent = results.filter((r) => new Date(r.date).getTime() >= weekAgo);
  return { drills: recent.length, transitions: recent.reduce((a, r) => a + r.transitions, 0) };
}

/** Improvement suggestions based on score and mode. */
export function drillSuggestions(transitions: number, previousBest: number | undefined, mode: "self" | "audio", ambiguousFrames = 0): string[] {
  const out: string[] = [];
  if (transitions < 15) out.push("Slow and clean beats fast and messy. Try the untimed mode and say each finger's job out loud.");
  else if (transitions < 30) out.push("Nice steady work. Look for 'anchor' fingers that can stay on (or slide along) a string between the two chords.");
  else if (transitions < 50) out.push("Good speed! Now check every string rings clearly — strum once after each change and listen.");
  else out.push("Excellent! Try a harder pair, or play this one with a metronome at a steady tempo.");
  if (previousBest !== undefined && transitions > previousBest) out.push(`New personal best — up ${transitions - previousBest} from ${previousBest}.`);
  else if (previousBest !== undefined && transitions < previousBest) out.push("Below your best today — that's normal. Consistency over days matters more than one score.");
  if (mode === "audio" && ambiguousFrames > 30) out.push("The microphone heard a lot of unclear sound. Strum all the chord's strings firmly once after each change, in a quiet room.");
  out.push("Stop and rest if your fingertips or wrist hurt.");
  return out;
}

export function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
