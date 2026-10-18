import { chordMidi, easiestShape, parseChord, shapeMidi, chordSymbol } from "@/lib/music/chords";
import { transposeChord, transposeKey } from "@/lib/music/transpose";
import { parseMelody, sectionChords, sectionLength, type MelodyNote } from "@/content/songs/parse";
import type { Song } from "@/content/songs/types";

/** Pure helpers for the Song Lab player — no audio, fully testable. */

export type PianoPattern = "block" | "broken" | "alberti";

export interface TimelineChord {
  chord: string;
  start: number;
  beats: number;
  sectionId: string;
  bar: number;
}

export interface TimelineNote extends MelodyNote {
  sectionId: string;
  index: number;
}

export interface Timeline {
  chords: TimelineChord[];
  notes: TimelineNote[];
  /** Total length in beats (from 0; pickup notes may start before 0). */
  length: number;
  /** Earliest event (negative when a pickup is included). */
  startBeat: number;
}

/** Simplify chords for beginners: drop 7ths/extensions/suspensions back to plain triads. */
export function simplifyChord(symbol: string): string {
  const c = parseChord(symbol);
  if (!c) return symbol;
  const map: Record<string, string> = {
    "7": "", maj7: "", "9": "", maj9: "", add9: "", "6": "", sus2: "", sus4: "", "7sus4": "",
    m7: "m", m6: "m", m9: "m", m7b5: "dim", dim7: "dim",
  };
  const suffix = c.suffix in map ? map[c.suffix] : c.suffix;
  return chordSymbol(c.rootName, suffix);
}

export interface SongOptions {
  /** Semitones to transpose (key change — changes the sounding pitch). */
  transpose: number;
  simplify: boolean;
  /** Only this section, or null for the whole song. */
  sectionId: string | null;
}

export function adaptChord(chord: string, song: Pick<Song, "key">, o: Pick<SongOptions, "transpose" | "simplify">): string {
  let c = o.simplify ? simplifyChord(chord) : chord;
  if (o.transpose) c = transposeChord(c, o.transpose, transposeKey(song.key, o.transpose));
  return c;
}

export function buildTimeline(song: Song, o: SongOptions): Timeline {
  const sections = o.sectionId ? song.sections.filter((s) => s.id === o.sectionId) : song.sections;
  const chords: TimelineChord[] = [];
  const notes: TimelineNote[] = [];
  let t = 0;
  let idx = 0;
  if (!o.sectionId && song.pickup) {
    const p = parseMelody(song.pickup);
    const len = p.reduce((a, n) => a + n.beats, 0);
    for (const n of parseMelody(song.pickup, -len)) notes.push({ ...n, midi: n.midi === null ? null : n.midi + o.transpose, sectionId: sections[0]?.id ?? "", index: idx++ });
  }
  for (const s of sections) {
    for (const c of sectionChords(s, song.beatsPerBar)) chords.push({ chord: adaptChord(c.chord, song, o), start: t + c.start, beats: c.beats, sectionId: s.id, bar: c.bar });
    for (const n of parseMelody(s.melody, t)) notes.push({ ...n, midi: n.midi === null ? null : n.midi + o.transpose, sectionId: s.id, index: idx++ });
    t += sectionLength(s, song.beatsPerBar);
  }
  return { chords, notes, length: t, startBeat: notes.length ? Math.min(0, notes[0].start) : 0 };
}

export function chordAt(tl: Timeline, beat: number): { current: TimelineChord | undefined; next: TimelineChord | undefined } {
  const i = tl.chords.findIndex((c) => beat >= c.start && beat < c.start + c.beats);
  return { current: tl.chords[i], next: i >= 0 ? tl.chords[i + 1] : tl.chords[0] };
}

export function noteAt(tl: Timeline, beat: number): TimelineNote | undefined {
  return tl.notes.find((n) => n.midi !== null && beat >= n.start && beat < n.start + n.beats);
}

export interface AccompEvent {
  /** Beat offset from the chord's start */
  offset: number;
  midis: number[];
  duration: number;
  direction?: "down" | "up";
}

/** Voicing for piano: root in octave 3 + triad above in octave 4. */
export function pianoAccompaniment(chord: string, beats: number, pattern: PianoPattern): AccompEvent[] {
  const c = parseChord(chord);
  if (!c) return [];
  const upper = chordMidi(chord, 4).slice(0, 4);
  const root = 48 + c.rootPc; // C3..B3
  if (pattern === "block") {
    const out: AccompEvent[] = [{ offset: 0, midis: [root, ...upper], duration: Math.min(beats, 2) * 0.95 }];
    if (beats >= 4) out.push({ offset: 2, midis: upper, duration: 1.9 });
    if (beats === 3) out.push({ offset: 1, midis: upper, duration: 0.9 }, { offset: 2, midis: upper, duration: 0.9 });
    return out;
  }
  const tones = [root, ...upper.slice(0, 3)];
  const seq = pattern === "broken" ? [tones[0], tones[1], tones[2], tones[3] ?? tones[1] + 12, tones[2], tones[1]] : [root, upper[2] ?? upper[1], upper[1], upper[2] ?? upper[1]];
  const out: AccompEvent[] = [];
  for (let i = 0; i * 0.5 < beats; i++) out.push({ offset: i * 0.5, midis: [seq[i % seq.length]], duration: 0.5 });
  return out;
}

/** Strum events from a pattern like "D-DU-UDU" (eighth-note slots, repeated per bar). */
export function strumAccompaniment(chord: string, beats: number, pattern: string): AccompEvent[] {
  const shape = easiestShape(chord);
  const midis = shape ? shapeMidi(shape) : chordMidi(chord, 3);
  const slots = pattern.replace(/\s/g, "");
  const out: AccompEvent[] = [];
  for (let i = 0; i * 0.5 < beats; i++) {
    const s = slots[i % slots.length];
    if (s === "D" || s === "U") out.push({ offset: i * 0.5, midis: s === "U" ? midis.slice(-4) : midis, duration: 1, direction: s === "D" ? "down" : "up" });
  }
  return out;
}

/** Score a play-along hit against the expected melody note (pitch, any octave optional). */
export function judgeMelodyHit(tl: Timeline, beat: number, midi: number, toleranceBeats = 0.35, anyOctave = true) {
  const candidates = tl.notes.filter((n) => n.midi !== null && Math.abs(n.start - beat) <= toleranceBeats + (beat > n.start && beat < n.start + n.beats ? n.beats : 0));
  const match = candidates.find((n) => (anyOctave ? (n.midi! - midi) % 12 === 0 : n.midi === midi));
  return { correct: !!match, expected: candidates[0]?.midi ?? null, note: match ?? candidates[0] };
}
