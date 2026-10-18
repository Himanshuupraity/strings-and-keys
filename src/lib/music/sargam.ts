import { mod12, pcName, type Spelling } from "./notes";

/**
 * Western ↔ Indian Sargam mapping.
 *
 * Sa is a MOVABLE tonic: every label is computed relative to the user's chosen Sa.
 * The mapping is the equal-tempered approximation; Hindustani intonation (shruti) and
 * raga-specific treatment can differ from equal temperament.
 */

export type SwaraVariant = "shuddha" | "komal" | "tivra";
export type Saptak = "mandra" | "madhya" | "taar" | "ati-mandra" | "ati-taar";
export type LabelMode = "western" | "sargam" | "both";

export interface Swara {
  /** Semitones above Sa (0–11) */
  degree: number;
  base: "Sa" | "Re" | "Ga" | "Ma" | "Pa" | "Dha" | "Ni";
  variant: SwaraVariant;
  /** Full plain-text name, e.g. "komal Re", "tivra Ma", "Pa" */
  full: string;
  /** Compact label using Bhatkhande-style markers: komal = underline (rendered), tivra = ′ */
  compact: string;
}

const SWARA_TABLE: Omit<Swara, "full" | "compact">[] = [
  { degree: 0, base: "Sa", variant: "shuddha" },
  { degree: 1, base: "Re", variant: "komal" },
  { degree: 2, base: "Re", variant: "shuddha" },
  { degree: 3, base: "Ga", variant: "komal" },
  { degree: 4, base: "Ga", variant: "shuddha" },
  { degree: 5, base: "Ma", variant: "shuddha" },
  { degree: 6, base: "Ma", variant: "tivra" },
  { degree: 7, base: "Pa", variant: "shuddha" },
  { degree: 8, base: "Dha", variant: "komal" },
  { degree: 9, base: "Dha", variant: "shuddha" },
  { degree: 10, base: "Ni", variant: "komal" },
  { degree: 11, base: "Ni", variant: "shuddha" },
];

export const SWARAS: Swara[] = SWARA_TABLE.map((s) => ({
  ...s,
  full: s.variant === "shuddha" ? s.base : `${s.variant} ${s.base}`,
  compact: s.variant === "tivra" ? `${s.base}′` : s.base,
}));

/** Swara for a pitch class / MIDI note relative to a tonic pitch class. */
export function swaraFor(noteMidiOrPc: number, tonicPc: number): Swara {
  return SWARAS[mod12(noteMidiOrPc - tonicPc)];
}

/**
 * Saptak (register) relative to a reference Sa (MIDI). The octave starting at `saMidi`
 * is madhya; the one below is mandra, the one above is taar.
 */
export function saptakFor(midi: number, saMidi: number): Saptak {
  const o = Math.floor((midi - saMidi) / 12);
  if (o <= -2) return "ati-mandra";
  if (o === -1) return "mandra";
  if (o === 0) return "madhya";
  if (o === 1) return "taar";
  return "ati-taar";
}

/** Reference Sa MIDI for a tonic: the tonic in octave 4 (C4..B4) by default. */
export function referenceSaMidi(tonicPc: number, octave = 4): number {
  return (octave + 1) * 12 + mod12(tonicPc);
}

export interface NoteLabel {
  western: string;
  swara: Swara;
  saptak: Saptak;
  /** Plain-text label for the current mode, e.g. "C — Sa" */
  text: string;
  /** Accessible text, e.g. "C, Sa (madhya saptak)" */
  aria: string;
}

export function labelNote(
  midi: number,
  opts: { mode: LabelMode; tonicPc: number; spelling?: Spelling; withOctave?: boolean; saOctave?: number },
): NoteLabel {
  const western = pcName(midi, opts.spelling ?? "sharp") + (opts.withOctave ? String(Math.floor(midi / 12) - 1) : "");
  const swara = swaraFor(midi, opts.tonicPc);
  const saptak = saptakFor(midi, referenceSaMidi(opts.tonicPc, opts.saOctave ?? 4));
  const text =
    opts.mode === "western" ? western : opts.mode === "sargam" ? swara.full : `${western} — ${swara.full}`;
  const aria =
    opts.mode === "western" ? western : `${opts.mode === "both" ? western + ", " : ""}${swara.full} (${saptak} saptak)`;
  return { western, swara, saptak, text, aria };
}

/** Bilawal thaat (all shuddha) == Western major scale degrees. */
export const BILAWAL_DEGREES = [0, 2, 4, 5, 7, 9, 11];

/** Simple beginner alankars expressed as scale-degree indexes into Bilawal (0 = Sa, 7 = taar Sa). */
export const ALANKARS: { id: string; name: string; description: string; pattern: number[] }[] = [
  { id: "aroh-avroh", name: "Aroh–Avroh", description: "Straight up and down: Sa Re Ga Ma Pa Dha Ni Sa — Sa Ni Dha Pa Ma Ga Re Sa", pattern: [0, 1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3, 2, 1, 0] },
  { id: "pairs", name: "Pairs (Sa Re, Re Ga…)", description: "Sa Re, Re Ga, Ga Ma, Ma Pa, Pa Dha, Dha Ni, Ni Sa", pattern: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7] },
  { id: "triplets", name: "Triplets (Sa Re Ga, Re Ga Ma…)", description: "Sa Re Ga, Re Ga Ma, Ga Ma Pa, Ma Pa Dha, Pa Dha Ni, Dha Ni Sa", pattern: [0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 4, 5, 4, 5, 6, 5, 6, 7] },
  { id: "skip", name: "Skip (Sa Ga, Re Ma…)", description: "Sa Ga, Re Ma, Ga Pa, Ma Dha, Pa Ni, Dha Sa", pattern: [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7] },
];

/** MIDI notes for an alankar starting at Sa (MIDI). */
export function alankarMidi(pattern: number[], saMidi: number): number[] {
  return pattern.map((i) => saMidi + (i === 7 ? 12 : BILAWAL_DEGREES[i]));
}
