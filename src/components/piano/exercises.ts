import { chordMidi } from "@/lib/music/chords";
import { fitToRange, notesOfPitchClass } from "@/lib/music/keyboard";
import { ALANKARS, alankarMidi, referenceSaMidi } from "@/lib/music/sargam";
import type { Duration } from "@/components/instruments/staff";

/**
 * Piano Lab exercise catalogue (pure data + resolver). Every exercise is resolved against the
 * currently visible key range so highlights always land on visible keys, whatever the preset.
 */
export type Hand = "right" | "left";

interface Variant {
  notes: number[];
  fingers?: number[];
  durations?: Duration[];
}

export type PianoExerciseDef =
  | {
      kind: "sequence";
      id: string;
      title: string;
      description: string;
      skill: string;
      group: ExerciseGroup;
      variants: Partial<Record<Hand, Variant>>;
      /** Show notation (Staff) for reading practice. */
      staff?: boolean;
      /** Hide key labels so the student reads the staff instead. */
      hideLabels?: boolean;
      /** Don't shift into range (e.g. middle C must be the real middle C). */
      exact?: boolean;
    }
  | { kind: "find-all"; id: string; title: string; description: string; skill: string; group: ExerciseGroup; pitchClass: number }
  | { kind: "chords"; id: string; title: string; description: string; skill: string; group: ExerciseGroup; chords: string[] }
  | { kind: "ear"; id: string; title: string; description: string; skill: string; group: ExerciseGroup; rounds: number; pool: number[] }
  | { kind: "sargam"; id: string; title: string; description: string; skill: string; group: ExerciseGroup };

export type ExerciseGroup = "Orientation" | "Five fingers & scales" | "Melodies" | "Reading" | "Chords" | "Ear training" | "Sargam";

export const EXERCISE_GROUPS: ExerciseGroup[] = ["Orientation", "Five fingers & scales", "Melodies", "Reading", "Chords", "Ear training", "Sargam"];

const q = (n: number): Duration[] => Array(n).fill("q");

export const PIANO_EXERCISES: PianoExerciseDef[] = [
  {
    kind: "find-all",
    id: "piano-find-every-c",
    title: "Find every C",
    description: "C is the white key just left of each group of two black keys. Click every C you can see.",
    skill: "keyboard-geography",
    group: "Orientation",
    pitchClass: 0,
  },
  {
    kind: "sequence",
    id: "piano-find-middle-c",
    title: "Find middle C",
    description: "Middle C (C4) is the C nearest the centre of a full piano — usually right under the brand name. Play it.",
    skill: "keyboard-geography",
    group: "Orientation",
    exact: true,
    variants: { right: { notes: [60], fingers: [1] }, left: { notes: [60], fingers: [1] } },
  },
  {
    kind: "sequence",
    id: "piano-five-finger-c",
    title: "C–D–E–F–G (five-finger position)",
    description: "One finger per key. Right hand: thumb (1) on C. Left hand: pinky (5) on the C below.",
    skill: "finger-independence",
    group: "Five fingers & scales",
    variants: {
      right: { notes: [60, 62, 64, 65, 67], fingers: [1, 2, 3, 4, 5] },
      left: { notes: [48, 50, 52, 53, 55], fingers: [5, 4, 3, 2, 1] },
    },
  },
  {
    kind: "sequence",
    id: "piano-c-major-scale",
    title: "C major scale (one octave)",
    description: "Right hand tucks the thumb under after E (1-2-3-1-2-3-4-5). Left hand crosses finger 3 over after G (5-4-3-2-1-3-2-1).",
    skill: "scales",
    group: "Five fingers & scales",
    staff: true,
    variants: {
      right: { notes: [60, 62, 64, 65, 67, 69, 71, 72], fingers: [1, 2, 3, 1, 2, 3, 4, 5] },
      left: { notes: [48, 50, 52, 53, 55, 57, 59, 60], fingers: [5, 4, 3, 2, 1, 3, 2, 1] },
    },
  },
  {
    kind: "sequence",
    id: "piano-ode-to-joy",
    title: "Ode to Joy (opening)",
    description: "Beethoven, public domain. Stays in C position — thumb on C.",
    skill: "melodies",
    group: "Melodies",
    staff: true,
    variants: {
      right: {
        notes: [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62],
        fingers: [3, 3, 4, 5, 5, 4, 3, 2, 1, 1, 2, 3, 3, 2, 2],
        durations: [...q(12), "q", "8", "h"],
      },
    },
  },
  {
    kind: "sequence",
    id: "piano-twinkle",
    title: "Twinkle Twinkle Little Star (opening)",
    description: "Traditional, public domain. Notice the jump from C up to G — your hand moves, so no fixed fingering here.",
    skill: "melodies",
    group: "Melodies",
    staff: true,
    variants: {
      right: {
        notes: [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60],
        durations: [...q(6), "h", ...q(6), "h"],
      },
    },
  },
  {
    kind: "sequence",
    id: "piano-mary-lamb",
    title: "Mary Had a Little Lamb",
    description: "Traditional, public domain. Uses only C, D, E and G.",
    skill: "melodies",
    group: "Melodies",
    staff: true,
    variants: {
      right: {
        notes: [64, 62, 60, 62, 64, 64, 64, 62, 62, 62, 64, 67, 67],
        fingers: [3, 2, 1, 2, 3, 3, 3, 2, 2, 2, 3, 5, 5],
        durations: [...q(6), "h", ...q(2), "h", "q", "q", "h"],
      },
    },
  },
  {
    kind: "sequence",
    id: "piano-follow-staff",
    title: "Follow the notes on the staff",
    description: "Key labels are hidden — read each note from the staff and play it. Line notes: E G B D F. Space notes: F A C E.",
    skill: "note-reading",
    group: "Reading",
    staff: true,
    hideLabels: true,
    variants: {
      right: { notes: [60, 64, 62, 65, 64, 67, 69, 67, 65, 64, 62, 60] },
      left: { notes: [48, 52, 50, 53, 55, 53, 52, 48] },
    },
  },
  {
    kind: "chords",
    id: "piano-triads",
    title: "Major & minor triads",
    description: "Hold all three notes of each chord together. Any octave or inversion counts.",
    skill: "chords",
    group: "Chords",
    chords: ["C", "F", "G", "Am", "Dm", "Em"],
  },
  {
    kind: "ear",
    id: "piano-ear-notes",
    title: "Identify notes by listening",
    description: "Listen to a note, then find it on the keyboard. Starts with white keys around middle C.",
    skill: "ear-training",
    group: "Ear training",
    rounds: 8,
    pool: [60, 62, 64, 65, 67, 69, 71, 72],
  },
  {
    kind: "sargam",
    id: "piano-sargam-alankar",
    title: "Sa Re Ga Ma & alankars",
    description: "Sargam patterns starting from your chosen Sa. Change Sa and the same pattern moves to a new key.",
    skill: "sargam",
    group: "Sargam",
  },
];

export interface ResolvedExercise {
  targets: number[];
  fingers?: number[];
  durations?: Duration[];
  chords?: { symbol: string; notes: number[] }[];
  pool?: number[];
  /** Semitones the written notes were shifted to fit the visible keys. */
  shift: number;
}

export function resolveExercise(
  def: PianoExerciseDef,
  opts: { low: number; high: number; hand: Hand; tonicPc: number; alankarId?: string },
): ResolvedExercise {
  const { low, high } = opts;
  const fit = (notes: number[]) => {
    const fitted = fitToRange(notes, low, high);
    return { notes: fitted, shift: notes.length ? fitted[0] - notes[0] : 0 };
  };
  switch (def.kind) {
    case "find-all":
      return { targets: notesOfPitchClass(def.pitchClass, low, high), shift: 0 };
    case "sequence": {
      const v = def.variants[opts.hand] ?? def.variants.right!;
      if (def.exact) return { targets: v.notes, fingers: v.fingers, durations: v.durations, shift: 0 };
      const f = fit(v.notes);
      return { targets: f.notes, fingers: v.fingers, durations: v.durations, shift: f.shift };
    }
    case "chords": {
      const chords = def.chords.map((symbol) => ({ symbol, notes: fitToRange(chordMidi(symbol, 4), low, high) }));
      return { targets: chords.flatMap((c) => c.notes), chords, shift: 0 };
    }
    case "ear": {
      const f = fit(def.pool);
      return { targets: [], pool: f.notes, shift: f.shift };
    }
    case "sargam": {
      const al = ALANKARS.find((a) => a.id === opts.alankarId) ?? ALANKARS[0];
      const f = fit(alankarMidi(al.pattern, referenceSaMidi(opts.tonicPc, 4)));
      return { targets: f.notes, shift: f.shift };
    }
  }
}

/** A two-octave window starting on a C, clamped inside a preset's range. */
export function focusWindow(start: number, low: number, high: number, span = 24): { low: number; high: number } {
  const maxStart = Math.max(low, high - span);
  const s = Math.min(Math.max(start, low), maxStart);
  return { low: s, high: Math.min(high, s + span) };
}

/** Pick a staff clef that keeps most notes near the staff. */
export function clefFor(notes: number[]): "treble" | "bass" {
  if (!notes.length) return "treble";
  const avg = notes.reduce((a, b) => a + b, 0) / notes.length;
  return avg < 58 ? "bass" : "treble";
}
