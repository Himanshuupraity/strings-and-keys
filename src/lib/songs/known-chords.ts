import type { Lesson } from "@/content/types";
import type { Song } from "@/content/songs/types";
import { songChords } from "@/content/songs/parse";
import { parseChord } from "@/lib/music/chords";
import { mod12 } from "@/lib/music/notes";
import { isDone } from "@/lib/progress/engine";
import type { ChordDrillResult, LessonProgress, SongProgress } from "@/lib/storage/schemas";

/**
 * Which chords the learner already knows, from evidence only (never assumed):
 *  - sections of songs they marked "I can play this"
 *  - 1-minute chord drill pairs at ≥ 15 changes per minute
 *  - completed lessons that teach or use the chord
 * Chords are compared as SHAPES (what your hands play): on guitar a capo song's sounding chords
 * are converted back to the shapes most chord sources use.
 */
export type Instrument = "guitar" | "piano";

/** Shape names as guitarists write them (C#, Eb, F#, G#, Bb …). */
const SHAPE_ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

/** Canonical name so "A#" and "Bb", "C/G" and "C" count as the same chord to know. */
export function canonChord(symbol: string): string | null {
  const c = parseChord(symbol);
  if (!c) return null;
  return SHAPE_ROOTS[mod12(c.rootPc)] + c.suffix;
}

function shapeOf(sounding: string, capo: number): string | null {
  const c = parseChord(sounding);
  if (!c) return null;
  return SHAPE_ROOTS[mod12(c.rootPc - capo)] + c.suffix;
}

/** The chords you actually play for a song (guitar: shapes under the usual capo). */
export function songShapes(song: Pick<Song, "sections" | "sourceCapo">, instrument: Instrument, sectionIds?: string[]): string[] {
  const capo = instrument === "guitar" ? song.sourceCapo ?? 0 : 0;
  const sections = sectionIds ? song.sections.filter((s) => sectionIds.includes(s.id)) : song.sections;
  const out: string[] = [];
  for (const sym of songChords({ sections })) {
    const s = shapeOf(sym, capo);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function lessonChords(lesson: Lesson): string[] {
  const out: string[] = [];
  const add = (s?: string) => {
    const c = s ? canonChord(s) : null;
    if (c && !out.includes(c)) out.push(c);
  };
  for (const step of lesson.steps) {
    if (step.kind === "exercise" && step.exercise.type === "play-chord") add(step.exercise.chord);
    const visual = "visual" in step ? step.visual : undefined;
    if (visual?.type === "chord-diagram") visual.chords.forEach(add);
    const audio = "audio" in step ? step.audio : undefined;
    if (audio?.type === "chord") add(audio.chord);
    if (audio?.type === "chords") audio.chords.forEach(add);
  }
  return out;
}

export interface KnownChordInput {
  instrument: Instrument;
  songs: Song[];
  songProgress: SongProgress[];
  drills: ChordDrillResult[];
  lessons: Lesson[];
  lessonProgress: Record<string, LessonProgress>;
}

export const DRILL_KNOWN_THRESHOLD = 15;

/** chord → why we think you know it (first reason found). */
export function knownChords(input: KnownChordInput): Map<string, string> {
  const known = new Map<string, string>();
  const add = (chord: string | null, why: string) => {
    if (chord && !known.has(chord)) known.set(chord, why);
  };
  for (const p of input.songProgress) {
    if (p.instrument !== input.instrument || !p.sectionsMastered.length) continue;
    const song = input.songs.find((s) => s.id === p.songId);
    if (!song) continue;
    for (const c of songShapes(song, input.instrument, p.sectionsMastered)) add(c, `you can play it in ${song.title}`);
  }
  if (input.instrument === "guitar") {
    for (const d of input.drills) {
      if (d.untimed || d.transitions < DRILL_KNOWN_THRESHOLD) continue;
      d.pair.forEach((c) => add(canonChord(c), `${d.transitions} changes/min in the chord drill`));
    }
  }
  for (const lesson of input.lessons) {
    if (lesson.track !== input.instrument && lesson.track !== "theory") continue;
    if (!isDone(input.lessonProgress[lesson.id])) continue;
    for (const c of lessonChords(lesson)) add(c, `from the lesson “${lesson.title}”`);
  }
  return known;
}
