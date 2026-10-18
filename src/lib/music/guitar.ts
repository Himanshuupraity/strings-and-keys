import { midiToName, mod12, nameToMidi, pcName, type Spelling } from "./notes";

/**
 * Guitar model.
 * String index 0 = lowest (6th string, low E) … index 5 = highest (1st string, high E).
 * String NUMBER (what guitarists say) = 6 - index.
 */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

export const TUNINGS: Record<string, { name: string; notes: number[] }> = {
  standard: { name: "Standard (E A D G B E)", notes: STANDARD_TUNING },
  dropD: { name: "Drop D (D A D G B E)", notes: [38, 45, 50, 55, 59, 64] },
  halfStepDown: { name: "Half-step down (Eb Ab Db Gb Bb Eb)", notes: [39, 44, 49, 54, 58, 63] },
};

export const STRING_NAMES_LOW_TO_HIGH = ["E", "A", "D", "G", "B", "E"];

export function stringNumber(index: number): number {
  return 6 - index;
}

export function stringLabel(index: number, tuning = STANDARD_TUNING): string {
  const n = midiToName(tuning[index]);
  return `String ${stringNumber(index)} (${n}${index === 0 ? ", low" : index === 5 ? ", high" : ""})`;
}

/** MIDI note at an absolute fret (0 = open, ignoring capo). */
export function fretMidi(stringIndex: number, fret: number, tuning = STANDARD_TUNING): number {
  if (stringIndex < 0 || stringIndex >= tuning.length) throw new Error("Bad string index");
  if (fret < 0) throw new Error("Bad fret");
  return tuning[stringIndex] + fret;
}

/**
 * With a capo on fret `capo`, an "open" string sounds `tuning + capo`.
 * Frets below the capo cannot be played (returns null).
 */
export function soundingMidi(stringIndex: number, absoluteFret: number, capo = 0, tuning = STANDARD_TUNING): number | null {
  const fret = absoluteFret === 0 ? capo : absoluteFret;
  if (fret < capo) return null;
  return fretMidi(stringIndex, fret, tuning);
}

export function openStringsWithCapo(capo: number, tuning = STANDARD_TUNING): number[] {
  return tuning.map((m) => m + capo);
}

export function fretNoteName(stringIndex: number, fret: number, spelling: Spelling = "sharp", tuning = STANDARD_TUNING): string {
  return pcName(fretMidi(stringIndex, fret, tuning), spelling);
}

export interface FretPosition {
  string: number;
  fret: number;
  midi: number;
}

/** Every position of a pitch class on the neck within fret range. */
export function positionsOfPitchClass(pc: number, maxFret = 12, tuning = STANDARD_TUNING, minFret = 0): FretPosition[] {
  const out: FretPosition[] = [];
  tuning.forEach((open, s) => {
    for (let f = minFret; f <= maxFret; f++) {
      if (mod12(open + f) === mod12(pc)) out.push({ string: s, fret: f, midi: open + f });
    }
  });
  return out;
}

/** Every position of an exact MIDI pitch (unison across strings). */
export function positionsOfMidi(midi: number, maxFret = 12, tuning = STANDARD_TUNING): FretPosition[] {
  const out: FretPosition[] = [];
  tuning.forEach((open, s) => {
    const f = midi - open;
    if (f >= 0 && f <= maxFret) out.push({ string: s, fret: f, midi });
  });
  return out;
}

/** Inlay markers used on most guitars. */
export const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
export const DOUBLE_INLAY_FRETS = [12, 24];

export function parseTab(note: string): FretPosition | null {
  // Accepts "6:3" (string number:fret)
  const m = /^(\d):(\d{1,2})$/.exec(note.trim());
  if (!m) return null;
  const s = 6 - parseInt(m[1], 10);
  const f = parseInt(m[2], 10);
  if (s < 0 || s > 5) return null;
  return { string: s, fret: f, midi: fretMidi(s, f) };
}

export { nameToMidi };
