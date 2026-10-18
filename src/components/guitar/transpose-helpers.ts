import { parseChord } from "@/lib/music/chords";
import { soundingChordForShape, transposeKey } from "@/lib/music/transpose";

/** Sounding chord for a shape + capo, spelled like the key it lands in (G shape, capo 3 → Bb, not A#). */
export function soundingName(shape: string, capo: number): string {
  const c = parseChord(shape);
  if (!c) return shape;
  const minor = c.suffix.startsWith("m") && !c.suffix.startsWith("maj");
  const key = transposeKey(c.rootName + (minor ? "m" : ""), capo);
  return soundingChordForShape(shape, capo, key);
}

/** Parse "F Bb C" / "F, Bb, C" / "F–Bb–C" into chord symbols, reporting invalid tokens. */
export function parseProgressionInput(text: string): { chords: string[]; invalid: string[] } {
  const tokens = text.split(/[\s,–—|-]+/).map((t) => t.trim()).filter(Boolean);
  const chords: string[] = [];
  const invalid: string[] = [];
  for (const t of tokens) (parseChord(t) ? chords : invalid).push(t);
  return { chords, invalid };
}
