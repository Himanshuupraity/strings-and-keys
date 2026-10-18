import type { ScaleTypeId } from "@/lib/music/scales";

/**
 * Song Lab data model.
 *
 * Melodies are written compactly as "C4:1 D4:0.5 r:0.5 …" — note:beats, "r" = rest.
 * A bar is either one chord for the whole bar, or a list of [chord, beats] pairs.
 */
export type BarChords = string | [string, number][];

export interface SongSection {
  id: string;
  name: string;
  bars: BarChords[];
  /** Melody for this section, starting on beat 1 of its first bar (optional). */
  melody?: string;
}

export type SongSource = "public-domain" | "original" | "user" | "chord-chart";

export interface SongPrerequisite {
  skill: string;
  /** Curriculum lesson id. Shown as a link only if the lesson exists. */
  lessonId?: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  source: SongSource;
  /** Short licence / provenance label shown on the song page. */
  licence: string;
  /** For original pieces: "Original practice piece in the style of …" */
  styleNote?: string;
  genre: "children" | "classical" | "folk" | "holiday" | "hymn" | "bollywood" | "bollywood-style" | "pop-style" | "user";
  difficulty: 1 | 2 | 3 | 4 | 5;
  key: string;
  /** Scale the melody is checked against. */
  scale: ScaleTypeId;
  /** Pitch-class names allowed in the melody besides the scale (e.g. G# in A minor). */
  extraNotes?: string[];
  tempo: number;
  beatsPerBar: number;
  /** Melody pickup (anacrusis) notes played before bar 1 of the first section. */
  pickup?: string;
  intro: string;
  sections: SongSection[];
  /** Eight eighth-note slots per 4/4 bar: D = down, U = up, - = rest. 3/4 uses six slots. */
  strum: { pattern: string; description: string };
  pianoTip: string;
  prerequisites: SongPrerequisite[];
  tags: string[];
  /* ---- Community chord charts of real songs (chords only: no lyrics, no melody) ---- */
  film?: string;
  composer?: string;
  year?: number;
  /** Capo most chord sources use for the beginner version. Sections always hold SOUNDING chords. */
  sourceCapo?: number;
  /** Chord sources the chart was cross-checked against. */
  sources?: { site: string; url: string }[];
  /** Chord order is cross-checked, but bar lengths are a practice approximation. */
  timingApproximate?: boolean;
  /** Tempo is a comfortable practice tempo, not the recording's tempo. */
  practiceTempo?: boolean;
}

/** Popular songs we DON'T include chords for — links to official / licensed sources only. */
export interface CatalogueSong {
  id: string;
  title: string;
  artist: string;
  /** Composer / film where well known. */
  credit?: string;
  region: "bollywood" | "international";
  film?: string;
  year?: number;
  composer?: string;
  officialAudioSearch: string;
  licensedSheetSearch: string;
  /** Web search for chord charts (results are third-party and unverified). */
  chordSearch: string;
}
