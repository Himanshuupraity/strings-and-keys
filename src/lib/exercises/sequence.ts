import { mod12 } from "@/lib/music/notes";

/**
 * Pure state machine for "play these notes in order" exercises. Works identically for virtual
 * instrument clicks, MIDI and (stable) microphone notes.
 */
export interface SequenceState {
  targets: number[];
  anyOctave: boolean;
  index: number;
  /** Per target: wrong attempts before getting it right. */
  wrongBefore: number[];
  mistakes: { expected: number; played: number; at: number }[];
  done: boolean;
}

export function startSequence(targets: number[], anyOctave = false): SequenceState {
  return { targets, anyOctave, index: 0, wrongBefore: targets.map(() => 0), mistakes: [], done: targets.length === 0 };
}

export function matches(target: number, played: number, anyOctave: boolean) {
  return anyOctave ? mod12(target) === mod12(played) : target === played;
}

export function stepSequence(s: SequenceState, played: number): { state: SequenceState; verdict: "correct" | "wrong" | "ignored"; expected?: number } {
  if (s.done) return { state: s, verdict: "ignored" };
  const expected = s.targets[s.index];
  if (matches(expected, played, s.anyOctave)) {
    const index = s.index + 1;
    return { state: { ...s, index, done: index >= s.targets.length }, verdict: "correct", expected };
  }
  const wrongBefore = s.wrongBefore.slice();
  wrongBefore[s.index]++;
  return { state: { ...s, wrongBefore, mistakes: [...s.mistakes, { expected, played, at: s.index }] }, verdict: "wrong", expected };
}

/** Accuracy: fraction of notes played right on the first try. */
export function sequenceAccuracy(s: SequenceState): number {
  if (!s.targets.length) return 1;
  return s.wrongBefore.filter((w) => w === 0).length / s.targets.length;
}

/** Plain-language summary of the most common mistake, for coaching. */
export function mistakeSummary(s: SequenceState, name: (m: number) => string): string | null {
  if (!s.mistakes.length) return null;
  const counts = new Map<string, number>();
  for (const m of s.mistakes) {
    const k = `${m.expected}->${m.played}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [exp, pl] = top[0].split("->").map(Number);
  const dir = pl > exp ? "higher" : "lower";
  const diff = Math.abs(pl - exp);
  return `You played ${name(pl)} instead of ${name(exp)} ${top[1] > 1 ? `${top[1]} times` : ""} — that's ${diff} semitone${diff === 1 ? "" : "s"} ${dir}.`.replace("  ", " ");
}

/** Find-all exercise: user must click every instance of a pitch class in a set of candidates. */
export function findAllProgress(candidates: number[], clicked: number[], pc: number) {
  const targets = candidates.filter((m) => mod12(m) === mod12(pc));
  const found = targets.filter((t) => clicked.includes(t));
  const wrong = clicked.filter((c) => mod12(c) !== mod12(pc));
  return { targets, found, wrong, done: found.length === targets.length, accuracy: targets.length ? Math.max(0, (found.length - wrong.length * 0.5) / targets.length) : 1 };
}
