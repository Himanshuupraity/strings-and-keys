import { isBlackKey, midiToName, mod12, MIDDLE_C } from "./notes";

/**
 * Piano keyboard ranges. Uses the app-wide convention MIDI 60 = C4 = middle C.
 * Note: some manufacturers (e.g. Yamaha) label middle C as "C3"; the physical key is the same.
 */
export type KeyboardSize = 25 | 49 | 61 | 88;

export const KEYBOARD_PRESETS: Record<KeyboardSize, { low: number; high: number; label: string; description: string }> = {
  25: { low: 48, high: 72, label: "25 keys", description: "Two octaves C3–C5 (lesson focus view)" },
  49: { low: 36, high: 84, label: "49 keys", description: "Compact keyboard, C2–C6" },
  61: { low: 36, high: 96, label: "61 keys", description: "Standard keyboard, C2–C7" },
  88: { low: 21, high: 108, label: "88 keys", description: "Full piano, A0–C8" },
};

export const SELECTABLE_SIZES: KeyboardSize[] = [49, 61, 88];

export interface PianoKey {
  midi: number;
  name: string;
  black: boolean;
  /** Index among white keys in the range (white keys only), or the white key to its left for black keys */
  whiteIndex: number;
  isMiddleC: boolean;
}

export function keysInRange(low: number, high: number): PianoKey[] {
  if (high < low) throw new Error("Invalid range");
  const keys: PianoKey[] = [];
  let whiteIndex = -1;
  for (let m = low; m <= high; m++) {
    const black = isBlackKey(m);
    if (!black) whiteIndex++;
    keys.push({ midi: m, name: midiToName(m), black, whiteIndex: Math.max(whiteIndex, 0), isMiddleC: m === MIDDLE_C });
  }
  return keys;
}

export function keysForPreset(size: KeyboardSize): PianoKey[] {
  const p = KEYBOARD_PRESETS[size];
  return keysInRange(p.low, p.high);
}

export function whiteKeyCount(keys: PianoKey[]): number {
  return keys.filter((k) => !k.black).length;
}

/**
 * Horizontal centre offset for a black key, as a fraction of a white-key width relative to
 * the right edge of its left white neighbour. Real pianos offset black keys slightly.
 */
export function blackKeyOffset(midi: number): number {
  switch (mod12(midi)) {
    case 1: return -0.1; // C#
    case 3: return 0.1; // D#
    case 6: return -0.12; // F#
    case 8: return 0; // G#
    case 10: return 0.12; // A#
    default: return 0;
  }
}

/** Computer keyboard → semitone offset from the current base C. Two rows like a DAW. */
export const COMPUTER_KEY_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ";": 16, "'": 17,
};

export function clampToRange(midi: number, low: number, high: number): number | null {
  return midi >= low && midi <= high ? midi : null;
}

/** All MIDI notes of a given pitch class in a range (e.g. "find every C"). */
export function notesOfPitchClass(pc: number, low: number, high: number): number[] {
  const out: number[] = [];
  for (let m = low; m <= high; m++) if (mod12(m) === mod12(pc)) out.push(m);
  return out;
}

/**
 * Shift a lesson's target notes into the visible range by whole octaves, so highlights always
 * land on visible keys regardless of preset.
 */
export function fitToRange(notes: number[], low: number, high: number): number[] {
  if (notes.length === 0) return notes;
  let shift = 0;
  const min = Math.min(...notes);
  const max = Math.max(...notes);
  while (min + shift < low) shift += 12;
  while (max + shift > high && min + shift - 12 >= low) shift -= 12;
  return notes.map((n) => n + shift);
}
