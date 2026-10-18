import { chordDifficulty, parseChord } from "@/lib/music/chords";
import { transposeChord, transposeKey } from "@/lib/music/transpose";
import type { Song } from "./types";

/**
 * Builds a playable chord-chart Song for a real Bollywood song from researched data.
 *
 * Input chords are the SHAPES guitarists play with `capo`; the Song stores the SOUNDING chords
 * (shape + capo semitones, spelled for the sounding key) so the player, piano view and capo helper
 * all work in real pitch. Chords only — no lyrics or melody are ever stored.
 */
export interface ChartInput {
  id: string;
  title: string;
  artist: string;
  composer: string;
  film: string;
  year: number;
  capo: number;
  /** Key of the shapes (e.g. "G" or "Am"). */
  shapeKey: string;
  beatsPerBar?: number;
  /** Recording tempo only when a source states it; otherwise a practice tempo is used. */
  tempoBpm?: number | null;
  sections: { name: string; shapes: string[]; repeat?: number }[];
  sources: { site: string; url: string }[];
  strum?: { pattern: string; description: string } | null;
  intro: string;
}

export const DEFAULT_STRUM = { pattern: "D-DU-UDU", description: "Our suggestion: the classic “down, down-up, up-down-up” ballad strum. Listen to the recording and adjust." };

export function difficultyFromShapes(shapes: string[]): Song["difficulty"] {
  const unique = Array.from(new Set(shapes));
  // Rated by the hardest shape you need (open chords 1–2, small barre 3, full barre 4–5).
  const hardest = Math.max(...unique.map(chordDifficulty));
  return Math.min(5, Math.max(1, Math.round(hardest))) as Song["difficulty"];
}

export function chart(d: ChartInput): Song {
  const soundingKey = transposeKey(d.shapeKey, d.capo);
  const minor = /m$/.test(soundingKey);
  const allShapes = d.sections.flatMap((s) => s.shapes);
  for (const c of allShapes) if (!parseChord(c)) throw new Error(`${d.title}: unknown chord ${c}`);
  return {
    id: d.id,
    title: d.title,
    artist: d.artist,
    composer: d.composer,
    film: d.film,
    year: d.year,
    source: "chord-chart",
    licence: "Community chord chart (chords only), cross-checked against independent sources · song © its owners",
    genre: "bollywood",
    difficulty: difficultyFromShapes(allShapes),
    key: soundingKey,
    scale: minor ? "naturalMinor" : "major",
    tempo: d.tempoBpm ?? 76,
    practiceTempo: !d.tempoBpm,
    beatsPerBar: d.beatsPerBar ?? 4,
    intro: d.intro,
    sections: d.sections.map((s, i) => ({
      id: `${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i}`,
      name: s.name,
      bars: Array.from({ length: s.repeat ?? 1 }).flatMap(() => s.shapes.map((c) => transposeChord(c, d.capo, soundingKey))),
    })),
    strum: d.strum ?? DEFAULT_STRUM,
    pianoTip: "Right hand plays the chord, left hand plays the chord's root note an octave lower. Change chords exactly when you hear the change in the recording.",
    prerequisites: [
      { skill: "Open chords", lessonId: "g3-em-am" },
      { skill: "Smooth chord changes", lessonId: "g3-chord-transitions" },
      ...(d.capo ? [{ skill: "Using a capo", lessonId: "t5-transposition" }] : []),
    ],
    tags: ["Bollywood", "chords only", d.film],
    sourceCapo: d.capo || undefined,
    sources: d.sources,
    timingApproximate: true,
  };
}
