/**
 * Core note utilities.
 *
 * Convention used across the whole app (documented in README):
 *   Scientific pitch notation, MIDI 60 = C4 = middle C, MIDI 69 = A4 = 440 Hz by default.
 */

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
export const NATURAL_LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export type Spelling = "sharp" | "flat";

export const DEFAULT_A4 = 440;
export const MIDDLE_C = 60;

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

/** Pitch class (0–11) name. */
export function pcName(pc: number, spelling: Spelling = "sharp"): string {
  const names = spelling === "flat" ? FLAT_NAMES : SHARP_NAMES;
  return names[mod12(pc)];
}

/** e.g. "C#/Db" for black keys, "C" for white keys. */
export function pcDualName(pc: number): string {
  const s = SHARP_NAMES[mod12(pc)];
  const f = FLAT_NAMES[mod12(pc)];
  return s === f ? s : `${s}/${f}`;
}

export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function midiToName(midi: number, spelling: Spelling = "sharp"): string {
  return `${pcName(midi, spelling)}${octaveOf(midi)}`;
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(mod12(midi));
}

const NOTE_RE = /^\s*([A-Ga-g])((?:#|b|♯|♭|x|##|bb)*)(-?\d+)?\s*$/;

/** Parses a note like "C", "Eb", "F#3", "B♭2". Returns pitch class + optional octave. */
export function parseNote(name: string): { letter: string; alter: number; pc: number; octave?: number } | null {
  const m = NOTE_RE.exec(name);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  let alter = 0;
  for (const ch of m[2].replace(/##|x/g, "♯♯").replace(/bb/g, "♭♭")) {
    if (ch === "#" || ch === "♯") alter += 1;
    if (ch === "b" || ch === "♭") alter -= 1;
  }
  const pc = mod12(LETTER_PC[letter] + alter);
  const octave = m[3] !== undefined ? parseInt(m[3], 10) : undefined;
  return { letter, alter, pc, octave };
}

export function pitchClassOf(name: string): number {
  const p = parseNote(name);
  if (!p) throw new Error(`Invalid note name: ${name}`);
  return p.pc;
}

/**
 * "C4" -> 60. Uses letter + alteration so that "B#3" -> 60 and "Cb4" -> 59 (octave belongs to the letter).
 */
export function nameToMidi(name: string): number {
  const p = parseNote(name);
  if (!p || p.octave === undefined) throw new Error(`Note needs an octave: ${name}`);
  return (p.octave + 1) * 12 + LETTER_PC[p.letter] + p.alter;
}

export function midiToFrequency(midi: number, a4 = DEFAULT_A4): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToMidiFloat(freq: number, a4 = DEFAULT_A4): number {
  return 69 + 12 * Math.log2(freq / a4);
}

export function centsBetween(freq: number, reference: number): number {
  return 1200 * Math.log2(freq / reference);
}

export interface DetectedNote {
  midi: number;
  name: string;
  pc: number;
  octave: number;
  /** Deviation from the nearest equal-tempered note, -50..+50 */
  cents: number;
  frequency: number;
  targetFrequency: number;
}

export function frequencyToNote(freq: number, a4 = DEFAULT_A4, spelling: Spelling = "sharp"): DetectedNote | null {
  if (!Number.isFinite(freq) || freq <= 0) return null;
  const exact = frequencyToMidiFloat(freq, a4);
  const midi = Math.round(exact);
  const targetFrequency = midiToFrequency(midi, a4);
  return {
    midi,
    name: midiToName(midi, spelling),
    pc: mod12(midi),
    octave: octaveOf(midi),
    cents: centsBetween(freq, targetFrequency),
    frequency: freq,
    targetFrequency,
  };
}

/** Keys whose signatures use flats (major, plus relative minors written as lower-case). */
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "d", "g", "c", "f", "bb", "eb", "ab"]);

/** Preferred accidental spelling for a key name such as "Bb" (major) or "g" / "Gm" (minor). */
export function spellingForKey(key: string): Spelling {
  const minor = /m$/.test(key) && !/maj/.test(key);
  const tonic = minor ? key.slice(0, -1) : key;
  const lookup = minor ? tonic.charAt(0).toLowerCase() + tonic.slice(1) : tonic;
  if (FLAT_KEYS.has(lookup)) return "flat";
  if (tonic.includes("b") && tonic.length > 1) return "flat";
  return "sharp";
}

export function transposeMidi(midi: number, semitones: number): number {
  return midi + semitones;
}
