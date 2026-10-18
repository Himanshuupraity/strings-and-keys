import type { Song } from "@/content/songs/types";
import type { SongProgress } from "@/lib/storage/schemas";
import { songShapes, type Instrument } from "./known-chords";
import { songStatus } from "./status";

export interface SongSuggestion {
  song: Song;
  knownChords: string[];
  newChords: string[];
  reason: string;
  score: number;
}

const isHindi = (s: Song) => s.genre === "bollywood" || s.genre === "bollywood-style";

function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Ranks songs to learn next. Prefers Bollywood chord charts, then Hindi practice pieces; songs
 * whose chords you mostly know (0–1 new chord); difficulty near your level; skips mastered songs.
 */
export function recommendSongs(input: {
  songs: Song[];
  known: Set<string>;
  songProgress: SongProgress[];
  instrument: Instrument;
  limit?: number;
}): SongSuggestion[] {
  const { songs, known, songProgress, instrument } = input;
  // Level from how many chords you know: beginners get the easiest songs first.
  const targetDifficulty = known.size < 4 ? 2 : known.size < 8 ? 3 : 4;
  const out: SongSuggestion[] = [];
  for (const song of songs) {
    const progress = songProgress.find((p) => p.songId === song.id && p.instrument === instrument);
    if (songStatus(song, progress).state === "mastered") continue;
    const shapes = songShapes(song, instrument);
    if (!shapes.length) continue;
    const knownChords = shapes.filter((c) => known.has(c));
    const newChords = shapes.filter((c) => !known.has(c));
    const knownFrac = knownChords.length / shapes.length;
    const source = song.source === "chord-chart" ? 1 : isHindi(song) ? 0.5 : -1.5;
    const score =
      knownFrac * 3 +
      (newChords.length <= 1 ? 1 : -(newChords.length - 1) * 0.6) -
      Math.abs(song.difficulty - targetDifficulty) * 0.6 +
      source -
      // A song you've started is a good one to continue.
      (progress && progress.sectionsMastered.length ? -0.5 : 0);
    let reason: string;
    if (!known.size) reason = `A good first song: ${list(shapes.slice(0, 4))}${shapes.length > 4 ? "…" : ""}`;
    else if (!newChords.length) reason = `You already know all its chords: ${list(knownChords)}`;
    else if (newChords.length === 1) reason = knownChords.length ? `You know ${list(knownChords)} — only ${newChords[0]} is new` : `Only one chord to learn: ${newChords[0]}`;
    else reason = knownChords.length ? `You know ${list(knownChords)}; ${newChords.length} new: ${list(newChords)}` : `${newChords.length} chords to learn: ${list(newChords)}`;
    out.push({ song, knownChords, newChords, reason, score });
  }
  return out.sort((a, b) => b.score - a.score || a.song.difficulty - b.song.difficulty).slice(0, input.limit ?? 3);
}
