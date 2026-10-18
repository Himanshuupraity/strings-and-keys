import type { Track } from "@/lib/storage/schemas";

/**
 * Curriculum data model. Lessons are pure data so the curriculum can grow without
 * touching UI code. The lesson player renders each step by `kind`.
 */

export type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const LEVEL_NAMES: Record<Level, string> = {
  0: "Absolute zero",
  1: "Music foundations",
  2: "Guitar fundamentals",
  3: "Guitar chords & rhythm",
  4: "Piano & keyboard fundamentals",
  5: "Scales & music theory",
  6: "Intermediate playing",
  7: "Advanced musician",
};

/** Something the student can hear. Rendered as a "Play example" button. */
export type AudioExample =
  | { type: "notes"; notes: (number | string)[]; /** seconds per note */ step?: number; instrument?: "piano" | "guitar" }
  | { type: "chord"; chord: string; instrument?: "piano" | "guitar"; strum?: boolean }
  | { type: "chords"; chords: string[]; beatsEach?: number; bpm?: number; instrument?: "piano" | "guitar" }
  | { type: "rhythm"; /** beat offsets within the bar(s) */ pattern: number[]; bpm: number; beatsPerBar?: number }
  | { type: "compare"; a: (number | string)[]; b: (number | string)[]; labelA: string; labelB: string };

/** What to show. Rendered with the shared instrument components. */
export type Visual =
  | { type: "keyboard"; low?: number; high?: number; highlight?: (number | string)[]; fingers?: Record<string, number>; showLabels?: boolean; caption?: string }
  | { type: "fretboard"; highlight?: { string: number; fret: number; label?: string }[]; highlightPitchClasses?: number[]; frets?: number; caption?: string }
  | { type: "chord-diagram"; chords: string[]; caption?: string }
  | { type: "staff"; clef: "treble" | "bass"; notes: { note: string; duration?: "w" | "h" | "q" | "8" }[]; caption?: string }
  | { type: "tab"; lines: string[]; caption?: string }
  | { type: "image-svg"; svg: "guitar-parts" | "piano-parts" | "posture-guitar" | "posture-piano" | "hand-fingers" | "sound-wave"; caption?: string };

export type Exercise =
  /** Play these notes in order on the chosen instrument (virtual, MIDI or mic). */
  | { type: "play-sequence"; instrument: "piano" | "guitar" | "either"; notes: (number | string)[]; /** match pitch class only (any octave) */ anyOctave?: boolean; prompt: string; fingers?: number[] }
  /** Find every instance of a pitch class on the virtual instrument. */
  | { type: "find-all"; instrument: "piano" | "guitar"; pitchClass: number; prompt: string }
  /** Play this chord (all notes held/strummed together). */
  | { type: "play-chord"; instrument: "piano" | "guitar" | "either"; chord: string; prompt: string }
  /** Ear training: hear and choose. */
  | { type: "ear-choice"; prompt: string; rounds: number; mode: "high-low" | "interval" | "major-minor" | "note-name" | "swara"; options?: string[] }
  /** Tap along to a rhythm; timing measured from taps/clicks/keys. */
  | { type: "tap-rhythm"; prompt: string; pattern: number[]; bpm: number; beatsPerBar: number; bars: number }
  /** Name a note shown on a staff / keyboard / fretboard. */
  | { type: "name-note"; prompt: string; on: "staff-treble" | "staff-bass" | "keyboard" | "fretboard"; notes: (number | string)[] }
  /** Use the microphone (or fall back to virtual) to play a single target note. */
  | { type: "mic-note"; instrument: "piano" | "guitar"; note: string; prompt: string };

export type LessonStep =
  | { id: string; kind: "explain"; title: string; body: string; hinglish?: string; audio?: AudioExample; visual?: Visual }
  | { id: string; kind: "listen"; title: string; body: string; audio: AudioExample; visual?: Visual; hinglish?: string }
  | { id: string; kind: "visual"; title: string; body: string; visual: Visual; audio?: AudioExample; hinglish?: string }
  | { id: string; kind: "exercise"; title: string; body: string; exercise: Exercise; /** Counts as measured proficiency evidence */ mastery?: boolean; passAccuracy?: number; hinglish?: string }
  /** Technique the app cannot observe: guided self-assessment, clearly labelled as such. */
  | { id: string; kind: "self-check"; title: string; body: string; checklist: string[]; hinglish?: string };

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  audio?: AudioExample;
  visual?: Visual;
}

export interface Lesson {
  id: string;
  track: Track;
  level: Level;
  order: number;
  title: string;
  summary: string;
  minutes: number;
  skills: string[];
  /** Lesson ids that must be COMPLETED before this unlocks. */
  prerequisites: string[];
  /** New words explained when they first appear. */
  glossary?: { term: string; meaning: string }[];
  steps: LessonStep[];
  quiz: QuizQuestion[];
  /** Fraction (0–1) of quiz answers needed to complete. */
  passScore: number;
  /** Video hub topic tags for recommendations. */
  topics: string[];
}

export interface Course {
  track: Track;
  title: string;
  description: string;
  levels: Level[];
}
