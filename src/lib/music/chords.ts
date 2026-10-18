import { Chord as TChord } from "tonal";
import { mod12, parseNote, pcName, spellingForKey, type Spelling } from "./notes";
import { STANDARD_TUNING } from "./guitar";

/** Supported chord qualities: suffix → semitone intervals from the root. */
export const CHORD_QUALITIES: Record<string, { name: string; intervals: number[]; tonal: string }> = {
  "": { name: "major", intervals: [0, 4, 7], tonal: "" },
  m: { name: "minor", intervals: [0, 3, 7], tonal: "m" },
  dim: { name: "diminished", intervals: [0, 3, 6], tonal: "dim" },
  aug: { name: "augmented", intervals: [0, 4, 8], tonal: "aug" },
  "5": { name: "power chord", intervals: [0, 7], tonal: "5" },
  sus2: { name: "suspended 2nd", intervals: [0, 2, 7], tonal: "sus2" },
  sus4: { name: "suspended 4th", intervals: [0, 5, 7], tonal: "sus4" },
  "6": { name: "major 6th", intervals: [0, 4, 7, 9], tonal: "6" },
  m6: { name: "minor 6th", intervals: [0, 3, 7, 9], tonal: "m6" },
  "7": { name: "dominant 7th", intervals: [0, 4, 7, 10], tonal: "7" },
  maj7: { name: "major 7th", intervals: [0, 4, 7, 11], tonal: "maj7" },
  m7: { name: "minor 7th", intervals: [0, 3, 7, 10], tonal: "m7" },
  m7b5: { name: "half-diminished", intervals: [0, 3, 6, 10], tonal: "m7b5" },
  dim7: { name: "diminished 7th", intervals: [0, 3, 6, 9], tonal: "dim7" },
  add9: { name: "add 9", intervals: [0, 4, 7, 14], tonal: "add9" },
  "9": { name: "dominant 9th", intervals: [0, 4, 7, 10, 14], tonal: "9" },
  maj9: { name: "major 9th", intervals: [0, 4, 7, 11, 14], tonal: "maj9" },
  m9: { name: "minor 9th", intervals: [0, 3, 7, 10, 14], tonal: "m9" },
  "7sus4": { name: "7 suspended 4th", intervals: [0, 5, 7, 10], tonal: "7sus4" },
};

const SUFFIX_ALIASES: Record<string, string> = {
  M: "", maj: "", major: "", min: "m", minor: "m", "-": "m", mi: "m",
  "°": "dim", o: "dim", "+": "aug", Maj7: "maj7", M7: "maj7", "Δ": "maj7", "Δ7": "maj7",
  min7: "m7", "-7": "m7", "ø": "m7b5", "ø7": "m7b5", sus: "sus4", "o7": "dim7", "°7": "dim7",
  dom7: "7", "2": "sus2", "4": "sus4",
};

export interface ParsedChord {
  symbol: string;
  rootName: string;
  rootPc: number;
  suffix: string;
  quality: (typeof CHORD_QUALITIES)[string];
  bassName?: string;
  bassPc?: number;
}

const CHORD_RE = /^([A-G](?:#|b|♯|♭)?)([^/]*)(?:\/([A-G](?:#|b|♯|♭)?))?$/;

export function normalizeSuffix(raw: string): string | null {
  const s = raw.trim();
  if (s in CHORD_QUALITIES) return s;
  if (s in SUFFIX_ALIASES) return SUFFIX_ALIASES[s];
  return null;
}

export function parseChord(symbol: string): ParsedChord | null {
  const m = CHORD_RE.exec(symbol.trim().replace(/♯/g, "#").replace(/♭/g, "b"));
  if (!m) return null;
  const root = parseNote(m[1]);
  const suffix = normalizeSuffix(m[2]);
  if (!root || suffix === null) return null;
  const bass = m[3] ? parseNote(m[3]) : null;
  return {
    symbol: symbol.trim(),
    rootName: m[1],
    rootPc: root.pc,
    suffix,
    quality: CHORD_QUALITIES[suffix],
    bassName: m[3],
    bassPc: bass?.pc,
  };
}

export function chordSymbol(rootName: string, suffix: string, bassName?: string): string {
  return `${rootName}${suffix}${bassName ? "/" + bassName : ""}`;
}

/** Pitch classes in a chord. */
export function chordPitchClasses(symbol: string): number[] {
  const c = parseChord(symbol);
  if (!c) throw new Error(`Unknown chord: ${symbol}`);
  const pcs = c.quality.intervals.map((i) => mod12(c.rootPc + i));
  if (c.bassPc !== undefined && !pcs.includes(c.bassPc)) pcs.unshift(c.bassPc);
  return Array.from(new Set(pcs));
}

/** Correctly spelled chord tones, e.g. "Bb" -> ["Bb","D","F"], "F#m7b5" -> ["F#","A","C","E"]. */
export function chordNoteNames(symbol: string): string[] {
  const c = parseChord(symbol);
  if (!c) throw new Error(`Unknown chord: ${symbol}`);
  const notes = TChord.get(`${c.rootName}${c.quality.tonal}`).notes;
  if (notes.length) return notes;
  const spelling: Spelling = c.rootName.includes("b") ? "flat" : "sharp";
  return c.quality.intervals.map((i) => pcName(c.rootPc + i, spelling));
}

/** Chord tones as MIDI notes, root in the given octave, stacked upwards, with optional inversion. */
export function chordMidi(symbol: string, octave = 4, inversion = 0): number[] {
  const c = parseChord(symbol);
  if (!c) throw new Error(`Unknown chord: ${symbol}`);
  const root = (octave + 1) * 12 + c.rootPc;
  const notes = c.quality.intervals.map((i) => root + i);
  for (let k = 0; k < inversion % notes.length; k++) {
    const n = notes.shift()!;
    notes.push(n + 12);
  }
  if (c.bassPc !== undefined) {
    let bass = (octave + 1) * 12 + c.bassPc;
    while (bass >= notes[0]) bass -= 12;
    notes.unshift(bass);
  }
  return notes;
}

/* ------------------------------------------------------------------ */
/* Guitar chord shapes                                                 */
/* ------------------------------------------------------------------ */

export interface GuitarShape {
  /** Chord symbol this shape sounds as (without capo). */
  chord: string;
  /** Frets low E → high E. -1 = muted, 0 = open. Absolute frets. */
  frets: number[];
  /** Finger numbers 1–4 (0 = none / open, -1 = muted). */
  fingers: number[];
  barre?: { fret: number; fromString: number; toString: number };
  /** 1 (easiest) – 5 (hardest) for a beginner. */
  difficulty: number;
  kind: "open" | "barre" | "power" | "partial";
  name?: string;
  tips?: string[];
}

const X = -1;

export const OPEN_SHAPES: GuitarShape[] = [
  { chord: "C", frets: [X, 3, 2, 0, 1, 0], fingers: [X, 3, 2, 0, 1, 0], difficulty: 2, kind: "open", tips: ["Ring finger on the 5th string, 3rd fret: that's your root C.", "Arch your fingers so the open G and high E ring.", "Don't strum the low E string."] },
  { chord: "A", frets: [X, 0, 2, 2, 2, 0], fingers: [X, 0, 1, 2, 3, 0], difficulty: 2, kind: "open", tips: ["Three fingers squeeze into the 2nd fret. Angle them slightly.", "Let the open high E ring — keep the ring finger off it."] },
  { chord: "G", frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], difficulty: 2, kind: "open", tips: ["Middle finger on low E, 3rd fret; index on A, 2nd fret; ring on high E, 3rd fret.", "Strum all six strings."] },
  { chord: "E", frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], difficulty: 1, kind: "open", tips: ["Same shape as A minor, moved one string up.", "Strum all six strings."] },
  { chord: "D", frets: [X, X, 0, 2, 3, 2], fingers: [X, X, 0, 1, 3, 2], difficulty: 2, kind: "open", tips: ["A small triangle on the top three strings.", "Start strumming from the open D (4th) string."] },
  { chord: "Am", frets: [X, 0, 2, 2, 1, 0], fingers: [X, 0, 2, 3, 1, 0], difficulty: 1, kind: "open", tips: ["Index on the B string 1st fret, middle and ring on the 2nd fret.", "Skip the low E string."] },
  { chord: "Em", frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], difficulty: 1, kind: "open", tips: ["Only two fingers — the easiest full chord.", "Strum all six strings."] },
  { chord: "Dm", frets: [X, X, 0, 2, 3, 1], fingers: [X, X, 0, 2, 3, 1], difficulty: 2, kind: "open", tips: ["Index on the high E 1st fret.", "Start from the open D string."] },
  { chord: "E7", frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], difficulty: 1, kind: "open" },
  { chord: "A7", frets: [X, 0, 2, 0, 2, 0], fingers: [X, 0, 2, 0, 3, 0], difficulty: 1, kind: "open" },
  { chord: "D7", frets: [X, X, 0, 2, 1, 2], fingers: [X, X, 0, 2, 1, 3], difficulty: 2, kind: "open" },
  { chord: "G7", frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], difficulty: 2, kind: "open" },
  { chord: "C7", frets: [X, 3, 2, 3, 1, 0], fingers: [X, 3, 2, 4, 1, 0], difficulty: 3, kind: "open" },
  { chord: "B7", frets: [X, 2, 1, 2, 0, 2], fingers: [X, 2, 1, 3, 0, 4], difficulty: 3, kind: "open" },
  { chord: "Am7", frets: [X, 0, 2, 0, 1, 0], fingers: [X, 0, 2, 0, 1, 0], difficulty: 1, kind: "open" },
  { chord: "Em7", frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0], difficulty: 1, kind: "open" },
  { chord: "Dm7", frets: [X, X, 0, 2, 1, 1], fingers: [X, X, 0, 2, 1, 1], difficulty: 2, kind: "open" },
  { chord: "Cmaj7", frets: [X, 3, 2, 0, 0, 0], fingers: [X, 3, 2, 0, 0, 0], difficulty: 1, kind: "open" },
  { chord: "Fmaj7", frets: [X, X, 3, 2, 1, 0], fingers: [X, X, 3, 2, 1, 0], difficulty: 2, kind: "open" },
  { chord: "Gmaj7", frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 1], difficulty: 2, kind: "open" },
  { chord: "Dmaj7", frets: [X, X, 0, 2, 2, 2], fingers: [X, X, 0, 1, 1, 1], difficulty: 2, kind: "open" },
  { chord: "Amaj7", frets: [X, 0, 2, 1, 2, 0], fingers: [X, 0, 2, 1, 3, 0], difficulty: 2, kind: "open" },
  { chord: "Asus2", frets: [X, 0, 2, 2, 0, 0], fingers: [X, 0, 1, 2, 0, 0], difficulty: 1, kind: "open" },
  { chord: "Asus4", frets: [X, 0, 2, 2, 3, 0], fingers: [X, 0, 1, 2, 3, 0], difficulty: 2, kind: "open" },
  { chord: "Dsus2", frets: [X, X, 0, 2, 3, 0], fingers: [X, X, 0, 1, 3, 0], difficulty: 1, kind: "open" },
  { chord: "Dsus4", frets: [X, X, 0, 2, 3, 3], fingers: [X, X, 0, 1, 2, 3], difficulty: 2, kind: "open" },
  { chord: "Esus4", frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0], difficulty: 2, kind: "open" },
  { chord: "Cadd9", frets: [X, 3, 2, 0, 3, 0], fingers: [X, 2, 1, 0, 3, 0], difficulty: 2, kind: "open" },
  { chord: "F", frets: [X, X, 3, 2, 1, 1], fingers: [X, X, 3, 2, 1, 1], barre: { fret: 1, fromString: 4, toString: 5 }, difficulty: 3, kind: "partial", name: "Easy F (small barre)", tips: ["Index finger flattens across the top two strings at fret 1.", "Only strum the top four strings."] },
  { chord: "E5", frets: [0, 2, 2, X, X, X], fingers: [0, 1, 2, X, X, X], difficulty: 1, kind: "power" },
  { chord: "A5", frets: [X, 0, 2, 2, X, X], fingers: [X, 0, 1, 2, X, X], difficulty: 1, kind: "power" },
  { chord: "D5", frets: [X, X, 0, 2, 3, X], fingers: [X, X, 0, 1, 2, X], difficulty: 1, kind: "power" },
];

/** Movable barre / power templates. `rootString` = string index whose fret is the root. */
interface MovableTemplate {
  suffix: string;
  rootString: 0 | 1;
  /** Offsets from the root fret per string; null = muted. */
  offsets: (number | null)[];
  fingers: number[];
  barreStrings?: [number, number];
  kind: GuitarShape["kind"];
  difficulty: number;
  name: string;
}

const MOVABLE: MovableTemplate[] = [
  { suffix: "", rootString: 0, offsets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], barreStrings: [0, 5], kind: "barre", difficulty: 4, name: "E-shape barre" },
  { suffix: "m", rootString: 0, offsets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1], barreStrings: [0, 5], kind: "barre", difficulty: 4, name: "Em-shape barre" },
  { suffix: "7", rootString: 0, offsets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1], barreStrings: [0, 5], kind: "barre", difficulty: 4, name: "E7-shape barre" },
  { suffix: "m7", rootString: 0, offsets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1], barreStrings: [0, 5], kind: "barre", difficulty: 4, name: "Em7-shape barre" },
  { suffix: "", rootString: 1, offsets: [null, 0, 2, 2, 2, 0], fingers: [X, 1, 2, 3, 4, 1], barreStrings: [1, 5], kind: "barre", difficulty: 4, name: "A-shape barre" },
  { suffix: "m", rootString: 1, offsets: [null, 0, 2, 2, 1, 0], fingers: [X, 1, 3, 4, 2, 1], barreStrings: [1, 5], kind: "barre", difficulty: 4, name: "Am-shape barre" },
  { suffix: "7", rootString: 1, offsets: [null, 0, 2, 0, 2, 0], fingers: [X, 1, 3, 1, 4, 1], barreStrings: [1, 5], kind: "barre", difficulty: 4, name: "A7-shape barre" },
  { suffix: "m7", rootString: 1, offsets: [null, 0, 2, 0, 1, 0], fingers: [X, 1, 3, 1, 2, 1], barreStrings: [1, 5], kind: "barre", difficulty: 4, name: "Am7-shape barre" },
  { suffix: "maj7", rootString: 1, offsets: [null, 0, 2, 1, 2, 0], fingers: [X, 1, 3, 2, 4, 1], barreStrings: [1, 5], kind: "barre", difficulty: 4, name: "Amaj7-shape barre" },
  { suffix: "5", rootString: 0, offsets: [0, 2, 2, null, null, null], fingers: [1, 3, 4, X, X, X], kind: "power", difficulty: 2, name: "Power chord (6th-string root)" },
  { suffix: "5", rootString: 1, offsets: [null, 0, 2, 2, null, null], fingers: [X, 1, 3, 4, X, X], kind: "power", difficulty: 2, name: "Power chord (5th-string root)" },
];

function buildMovable(t: MovableTemplate, rootPc: number, rootName: string, maxFret = 12): GuitarShape | null {
  const open = STANDARD_TUNING[t.rootString];
  let fret = mod12(rootPc - open);
  // Fret 0 would be an open shape (covered by OPEN_SHAPES); prefer first real barre position.
  if (fret === 0) fret = 12;
  if (fret > maxFret) return null;
  const frets = t.offsets.map((o) => (o === null ? X : fret + o));
  const shape: GuitarShape = {
    chord: rootName + t.suffix,
    frets,
    fingers: t.fingers,
    difficulty: t.difficulty,
    kind: t.kind,
    name: `${t.name} at fret ${fret}`,
  };
  if (t.barreStrings) shape.barre = { fret, fromString: t.barreStrings[0], toString: t.barreStrings[1] };
  return shape;
}

/** All known shapes for a chord symbol (open shapes first, then movable barre shapes), easiest first. */
export function shapesForChord(symbol: string): GuitarShape[] {
  const c = parseChord(symbol);
  if (!c) return [];
  const pcs = chordPitchClasses(`${c.rootName}${c.suffix}`);
  const out: GuitarShape[] = [];
  for (const s of OPEN_SHAPES) {
    const sc = parseChord(s.chord)!;
    if (sc.rootPc === c.rootPc && sc.suffix === c.suffix) out.push({ ...s, chord: `${c.rootName}${c.suffix}` });
  }
  for (const t of MOVABLE) {
    if (t.suffix !== c.suffix) continue;
    const s = buildMovable(t, c.rootPc, c.rootName);
    if (s) out.push(s);
  }
  // Safety: keep only shapes whose sounding notes are chord tones.
  return out
    .filter((s) => shapePitchClasses(s).every((pc) => pcs.includes(pc)))
    .sort((a, b) => a.difficulty - b.difficulty || lowestFret(a) - lowestFret(b));
}

function lowestFret(s: GuitarShape): number {
  const fretted = s.frets.filter((f) => f > 0);
  return fretted.length ? Math.min(...fretted) : 0;
}

export function easiestShape(symbol: string): GuitarShape | undefined {
  return shapesForChord(symbol)[0];
}

export function shapeMidi(shape: Pick<GuitarShape, "frets">, capo = 0, tuning = STANDARD_TUNING): number[] {
  return shape.frets.flatMap((f, s) => (f < 0 ? [] : [tuning[s] + f + capo]));
}

export function shapePitchClasses(shape: Pick<GuitarShape, "frets">, capo = 0): number[] {
  return Array.from(new Set(shapeMidi(shape, capo).map(mod12)));
}

/** Simple difficulty for a chord symbol on guitar, based on its easiest shape. Unknown = 5. */
export function chordDifficulty(symbol: string): number {
  return easiestShape(symbol)?.difficulty ?? 5;
}

/* ------------------------------------------------------------------ */
/* Chord recognition from a set of pitch classes                       */
/* ------------------------------------------------------------------ */

export interface ChordMatch {
  symbol: string;
  score: number;
  missing: number[];
  extra: number[];
}

const RECOGNIZE_SUFFIXES = ["", "m", "7", "m7", "maj7", "sus2", "sus4", "dim", "aug", "5"];

/** Rank chords that best explain a set of pitch classes. Pure — no audio. */
export function identifyChord(pcs: number[], spelling: Spelling = "sharp"): ChordMatch[] {
  const set = new Set(pcs.map(mod12));
  const out: ChordMatch[] = [];
  for (let root = 0; root < 12; root++) {
    for (const suffix of RECOGNIZE_SUFFIXES) {
      const tones = CHORD_QUALITIES[suffix].intervals.map((i) => mod12(root + i));
      const missing = tones.filter((t) => !set.has(t));
      const extra = [...set].filter((p) => !tones.includes(p));
      const hit = tones.length - missing.length;
      const score = hit / tones.length - extra.length * 0.25 - (set.has(root) ? 0 : 0.2) - tones.length * 0.01;
      out.push({ symbol: pcName(root, spelling) + suffix, score, missing, extra });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

export function compareChordTones(expected: string, detectedPcs: number[]) {
  const tones = chordPitchClasses(expected);
  const set = new Set(detectedPcs.map(mod12));
  const spelling = spellingForKey(parseChord(expected)?.rootName ?? "C");
  return {
    expected: tones,
    found: tones.filter((t) => set.has(t)),
    missing: tones.filter((t) => !set.has(t)),
    unwanted: [...set].filter((p) => !tones.includes(p)),
    coverage: tones.filter((t) => set.has(t)).length / tones.length,
    name: (pc: number) => pcName(pc, spelling),
  };
}
