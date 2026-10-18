import { chordDifficulty, chordSymbol, easiestShape, parseChord, shapePitchClasses, chordPitchClasses, type GuitarShape } from "./chords";
import { mod12, parseNote, pcName, spellingForKey, type Spelling } from "./notes";

/** All 12 major key names with conventional spelling. */
export const MAJOR_KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const MINOR_KEYS = ["Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];

export function keyTonicPc(key: string): number {
  const p = parseNote(key.replace(/m$/, ""));
  if (!p) throw new Error(`Bad key ${key}`);
  return p.pc;
}

export function isMinorKey(key: string): boolean {
  return /m$/.test(key);
}

/** Transpose a key name by semitones, keeping major/minor and using conventional spelling. */
export function transposeKey(key: string, semitones: number): string {
  const minor = isMinorKey(key);
  const pc = mod12(keyTonicPc(key) + semitones);
  return minor ? MINOR_KEYS[pc] : MAJOR_KEYS[pc];
}

export function semitonesBetweenKeys(from: string, to: string): number {
  return mod12(keyTonicPc(to) - keyTonicPc(from));
}

/**
 * Transpose a chord symbol. Spelling follows the *target key* when given (so moving to F gives Bb,
 * not A#), otherwise follows the direction-neutral sharp/flat preference of the source root.
 */
export function transposeChord(symbol: string, semitones: number, targetKey?: string): string {
  const c = parseChord(symbol);
  if (!c) throw new Error(`Unknown chord: ${symbol}`);
  const spelling: Spelling = targetKey ? spellingForKey(targetKey) : c.rootName.includes("b") ? "flat" : "sharp";
  const root = pcName(c.rootPc + semitones, spelling);
  const bass = c.bassPc !== undefined ? pcName(c.bassPc + semitones, spelling) : undefined;
  return chordSymbol(root, c.suffix, bass);
}

export function transposeProgression(chords: string[], semitones: number, targetKey?: string): string[] {
  return chords.map((c) => transposeChord(c, semitones, targetKey));
}

/** Pitch-class signature of a chord, used to verify sounding equality independent of spelling. */
export function soundingSignature(symbol: string): string {
  return chordPitchClasses(symbol).slice().sort((a, b) => a - b).join(",");
}

export function sameSounding(a: string, b: string): boolean {
  const pa = parseChord(a);
  const pb = parseChord(b);
  if (!pa || !pb) return false;
  return pa.rootPc === pb.rootPc && pa.suffix === pb.suffix && pa.bassPc === pb.bassPc;
}

/* ------------------------------------------------------------------ */
/* Capo                                                               */
/* ------------------------------------------------------------------ */

/** Chord that SOUNDS when you play `shape` with a capo on fret `capo`. */
export function soundingChordForShape(shape: string, capo: number, key?: string): string {
  return transposeChord(shape, capo, key);
}

/** Chord SHAPE you need to play so that `sounding` comes out with a capo on `capo`. */
export function shapeForSoundingChord(sounding: string, capo: number): string {
  // Shapes are named in their open-position spelling; prefer the spelling used by common open shapes.
  const c = parseChord(sounding)!;
  const pc = mod12(c.rootPc - capo);
  const shapeRoots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
  const bass = c.bassPc !== undefined ? shapeRoots[mod12(c.bassPc - capo)] : undefined;
  return chordSymbol(shapeRoots[pc], c.suffix, bass);
}

export interface CapoArrangement {
  capo: number;
  /** Shapes to finger, relative to the capo. */
  shapes: string[];
  /** What actually comes out — must equal the original progression. */
  sounding: string[];
  /** Key of the shapes ("you're playing in G shapes"). */
  shapeKey?: string;
  soundingKey?: string;
  difficulty: number;
  maxDifficulty: number;
  requiresBarre: boolean;
  allOpen: boolean;
  shapeDetails: (GuitarShape | undefined)[];
  /** Verified: shapes + capo reproduce original sounding pitch classes. */
  verified: boolean;
  notes: string[];
}

/**
 * Generate capo arrangements that PRESERVE the original sounding key.
 * For each capo position, the shape progression is the original transposed down by `capo`.
 * Each arrangement is verified by re-computing the sounding pitch classes from real shapes.
 */
export function capoArrangements(progression: string[], originalKey?: string, maxCapo = 9): CapoArrangement[] {
  const out: CapoArrangement[] = [];
  for (let capo = 0; capo <= maxCapo; capo++) {
    const shapes = progression.map((c) => shapeForSoundingChord(c, capo));
    const uniqueShapes = Array.from(new Set(shapes));
    const details = shapes.map((s) => easiestShape(s));
    const difficulties = uniqueShapes.map(chordDifficulty);
    const maxDifficulty = Math.max(...difficulties);
    const difficulty = difficulties.reduce((a, b) => a + b, 0) / difficulties.length;
    const requiresBarre = details.some((d) => !d || d.kind === "barre");
    const allOpen = details.every((d) => d && (d.kind === "open" || d.kind === "power"));
    // Verify each shape + capo produces exactly the intended chord tones.
    const verified = progression.every((orig, i) => {
      const d = details[i];
      if (!d) return false;
      const sounding = shapePitchClasses(d, capo).sort().join(",");
      const target = new Set(chordPitchClasses(orig));
      return sounding.split(",").every((pc) => target.has(Number(pc)));
    });
    const notes: string[] = [];
    if (capo > 7) notes.push("High capo positions sound brighter and the frets get cramped.");
    if (requiresBarre) notes.push("Needs at least one barre chord.");
    if (details.some((d) => d?.kind === "partial")) notes.push("Uses the small 'easy F' barre on two strings.");
    out.push({
      capo,
      shapes,
      sounding: progression.slice(),
      shapeKey: originalKey ? transposeKey(originalKey, -capo) : undefined,
      soundingKey: originalKey,
      difficulty: Number(difficulty.toFixed(2)),
      maxDifficulty,
      requiresBarre,
      allOpen,
      shapeDetails: details,
      verified,
      notes,
    });
  }
  // Easiest first. High capo positions get a small penalty (cramped frets, thin tone); lower capo wins ties.
  const comfort = (a: CapoArrangement) => a.difficulty + Math.max(0, a.capo - 5) * 0.25;
  return out.sort((a, b) => a.maxDifficulty - b.maxDifficulty || comfort(a) - comfort(b) || a.capo - b.capo);
}

export function bestCapoArrangement(progression: string[], originalKey?: string): CapoArrangement {
  return capoArrangements(progression, originalKey).filter((a) => a.verified)[0] ?? capoArrangements(progression, originalKey)[0];
}

/**
 * Key-change alternatives (NO capo): the song is moved to a new key. These change the sounding pitch,
 * which matters when singing along with a recording — label them clearly in the UI.
 */
export function keyChangeOptions(progression: string[], originalKey: string) {
  return MAJOR_KEYS.concat()
    .map((_, i) => i)
    .filter((s) => s !== 0)
    .map((semitones) => {
      const targetKey = transposeKey(originalKey, semitones);
      const chords = transposeProgression(progression, semitones, targetKey);
      const diffs = Array.from(new Set(chords)).map(chordDifficulty);
      return {
        semitones: semitones > 6 ? semitones - 12 : semitones,
        targetKey,
        chords,
        maxDifficulty: Math.max(...diffs),
        difficulty: diffs.reduce((a, b) => a + b, 0) / diffs.length,
      };
    })
    .sort((a, b) => a.maxDifficulty - b.maxDifficulty || a.difficulty - b.difficulty || Math.abs(a.semitones) - Math.abs(b.semitones));
}

/** Roman numeral analysis helper for display ("I – IV – V"). Major keys only, diatonic triads. */
export function romanNumeral(chord: string, key: string): string | null {
  const c = parseChord(chord);
  if (!c) return null;
  const tonic = keyTonicPc(key);
  const degree = mod12(c.rootPc - tonic);
  const major = [0, 2, 4, 5, 7, 9, 11];
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII"];
  const idx = major.indexOf(degree);
  if (idx === -1) return null;
  const minorish = c.suffix.startsWith("m") && !c.suffix.startsWith("maj");
  const base = minorish || c.suffix === "dim" ? romans[idx].toLowerCase() : romans[idx];
  return base + (c.suffix === "dim" ? "°" : c.suffix === "7" ? "7" : "");
}
