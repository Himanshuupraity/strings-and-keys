import { Key, Note, Scale as TScale } from "tonal";
import { mod12, parseNote, pcName, spellingForKey } from "./notes";

export const SCALE_TYPES: Record<string, { name: string; intervals: number[]; tonal: string; description: string }> = {
  major: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11], tonal: "major", description: "Bright and happy. Whole-whole-half-whole-whole-whole-half." },
  naturalMinor: { name: "Natural minor", intervals: [0, 2, 3, 5, 7, 8, 10], tonal: "minor", description: "Darker, sadder sound. Shares its notes with the relative major." },
  harmonicMinor: { name: "Harmonic minor", intervals: [0, 2, 3, 5, 7, 8, 11], tonal: "harmonic minor", description: "Natural minor with a raised 7th — an exotic leap near the top." },
  melodicMinor: { name: "Melodic minor (ascending)", intervals: [0, 2, 3, 5, 7, 9, 11], tonal: "melodic minor", description: "Raised 6th and 7th going up; classical style uses natural minor coming down." },
  majorPentatonic: { name: "Major pentatonic", intervals: [0, 2, 4, 7, 9], tonal: "major pentatonic", description: "Five notes, no half steps. Hard to sound bad!" },
  minorPentatonic: { name: "Minor pentatonic", intervals: [0, 3, 5, 7, 10], tonal: "minor pentatonic", description: "The classic rock and blues lead scale." },
  blues: { name: "Blues", intervals: [0, 3, 5, 6, 7, 10], tonal: "blues", description: "Minor pentatonic plus the 'blue note' (♭5)." },
  chromatic: { name: "Chromatic", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], tonal: "chromatic", description: "All 12 notes in half steps." },
};

export type ScaleTypeId = keyof typeof SCALE_TYPES;

export function scalePitchClasses(tonic: string, type: ScaleTypeId): number[] {
  const t = parseNote(tonic);
  if (!t) throw new Error(`Bad tonic ${tonic}`);
  return SCALE_TYPES[type].intervals.map((i) => mod12(t.pc + i));
}

/** Correctly spelled scale notes (F major -> F G A Bb C D E). */
export function scaleNoteNames(tonic: string, type: ScaleTypeId): string[] {
  const notes = TScale.get(`${tonic} ${SCALE_TYPES[type].tonal}`).notes;
  if (notes.length) return notes;
  const minor = type !== "major" && type !== "majorPentatonic";
  const spelling = spellingForKey(minor ? tonic + "m" : tonic);
  return scalePitchClasses(tonic, type).map((pc) => pcName(pc, spelling));
}

/** Scale as ascending MIDI notes from the tonic in `octave`, including the octave on top. */
export function scaleMidi(tonic: string, type: ScaleTypeId, octave = 4, octaves = 1): number[] {
  const t = parseNote(tonic)!;
  const start = (octave + 1) * 12 + t.pc;
  const out: number[] = [];
  for (let o = 0; o < octaves; o++) for (const i of SCALE_TYPES[type].intervals) out.push(start + 12 * o + i);
  out.push(start + 12 * octaves);
  return out;
}

export function intervalName(semitones: number): string {
  const names = [
    "Unison", "Minor 2nd", "Major 2nd", "Minor 3rd", "Major 3rd", "Perfect 4th",
    "Tritone", "Perfect 5th", "Minor 6th", "Major 6th", "Minor 7th", "Major 7th", "Octave",
  ];
  if (semitones >= 0 && semitones <= 12) return names[semitones];
  return `${semitones} semitones`;
}

/** Circle of fifths, clockwise from C, with relative minors and signature counts. */
export function circleOfFifths(): { major: string; minor: string; signature: string; accidentals: number }[] {
  const majors = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
  return majors.map((m) => {
    const k = Key.majorKey(m);
    const sig = k.keySignature;
    return { major: m, minor: k.minorRelative + "m", signature: sig, accidentals: sig.length * (sig.includes("b") ? -1 : 1) };
  });
}

export function diatonicChords(tonic: string, mode: "major" | "minor" = "major", sevenths = false): string[] {
  if (mode === "major") {
    const k = Key.majorKey(tonic);
    return [...(sevenths ? k.chords : k.triads)];
  }
  const k = Key.minorKey(tonic);
  return [...(sevenths ? k.natural.chords : k.natural.triads)];
}

export function relativeMinor(major: string): string {
  return Key.majorKey(major).minorRelative;
}

export function relativeMajor(minor: string): string {
  return Key.minorKey(minor).relativeMajor;
}

export function enharmonic(note: string): string {
  return Note.enharmonic(note);
}

/** Scale degree (1-based) of a pitch class in a scale, or null. */
export function scaleDegree(pc: number, tonic: string, type: ScaleTypeId): number | null {
  const idx = scalePitchClasses(tonic, type).indexOf(mod12(pc));
  return idx === -1 ? null : idx + 1;
}
