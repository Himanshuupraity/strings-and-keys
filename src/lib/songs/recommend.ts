import type { Song } from "@/content/songs/types";
import type { SongProgress } from "@/lib/storage/schemas";
import { songShapes, type Instrument } from "./known-chords";
import { songStatus } from "./status";
import { enText, type I18nMessage, type MessageVar } from "@/lib/i18n/messages";

export interface SongSuggestion {
  song: Song;
  knownChords: string[];
  newChords: string[];
  /** English text of reasonMsg. */
  reason: string;
  /** Why this song — translatable; format it in the UI. */
  reasonMsg: I18nMessage;
  score: number;
}

const isHindi = (s: Song) => s.genre === "bollywood" || s.genre === "bollywood-style";

/** "G, D and Bm" as a translatable value. */
function list(items: string[]): MessageVar {
  if (items.length <= 1) return items.join("");
  return { key: "list.and", vars: { head: items.slice(0, -1).join(", "), last: items[items.length - 1] } };
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
    let reasonMsg: I18nMessage;
    if (!known.size) reasonMsg = { key: shapes.length > 4 ? "rec.firstSongMore" : "rec.firstSong", vars: { chords: list(shapes.slice(0, 4)) } };
    else if (!newChords.length) reasonMsg = { key: "rec.allKnown", vars: { chords: list(knownChords) } };
    else if (newChords.length === 1) reasonMsg = knownChords.length ? { key: "rec.oneNew", vars: { known: list(knownChords), chord: newChords[0] } } : { key: "rec.oneToLearn", vars: { chord: newChords[0] } };
    else reasonMsg = knownChords.length ? { key: "rec.someNew", vars: { known: list(knownChords), n: newChords.length, chords: list(newChords) } } : { key: "rec.nToLearn", vars: { n: newChords.length, chords: list(newChords) } };
    out.push({ song, knownChords, newChords, reason: enText(reasonMsg), reasonMsg, score });
  }
  return out.sort((a, b) => b.score - a.score || a.song.difficulty - b.song.difficulty).slice(0, input.limit ?? 3);
}
