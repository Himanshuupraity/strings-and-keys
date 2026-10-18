import { nameToMidi } from "@/lib/music/notes";
import type { BarChords, Song, SongSection } from "./types";

export interface MelodyNote {
  /** MIDI note, or null for a rest. */
  midi: number | null;
  beats: number;
  /** Start beat relative to the start of its section (pickup notes are negative). */
  start: number;
}

export function parseMelody(src: string | undefined, startBeat = 0): MelodyNote[] {
  if (!src?.trim()) return [];
  let t = startBeat;
  return src
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [n, b] = tok.split(":");
      const beats = Number(b);
      if (!Number.isFinite(beats) || beats <= 0) throw new Error(`Bad melody token "${tok}"`);
      const note: MelodyNote = { midi: n === "r" ? null : nameToMidi(n), beats, start: t };
      t += beats;
      return note;
    });
}

export interface ChordSpan {
  chord: string;
  /** Start beat relative to the section start. */
  start: number;
  beats: number;
  bar: number;
}

export function barSpans(bar: BarChords, beatsPerBar: number): { chord: string; beats: number }[] {
  if (typeof bar === "string") return [{ chord: bar, beats: beatsPerBar }];
  return bar.map(([chord, beats]) => ({ chord, beats }));
}

export function sectionChords(section: SongSection, beatsPerBar: number): ChordSpan[] {
  const out: ChordSpan[] = [];
  let t = 0;
  section.bars.forEach((bar, i) => {
    for (const s of barSpans(bar, beatsPerBar)) {
      out.push({ chord: s.chord, start: t, beats: s.beats, bar: i });
      t += s.beats;
    }
  });
  return out;
}

export function sectionLength(section: SongSection, beatsPerBar: number): number {
  return section.bars.reduce<number>((a, b) => a + barSpans(b, beatsPerBar).reduce((x, s) => x + s.beats, 0), 0);
}

/** Every distinct chord in a song, in order of first appearance. */
export function songChords(song: Pick<Song, "sections">): string[] {
  const seen: string[] = [];
  for (const s of song.sections)
    for (const b of s.bars) for (const sp of barSpans(b, 4)) if (!seen.includes(sp.chord)) seen.push(sp.chord);
  return seen;
}

/** Main progression for display: first section's chords. */
export function sectionProgression(section: SongSection): string[] {
  return section.bars.flatMap((b) => barSpans(b, 4).map((s) => s.chord));
}

/**
 * Parse a chord chart typed by a user: bars separated by "|", chords inside a bar by spaces
 * (split evenly). Returns null for empty input.
 */
export function parseChordChart(text: string, beatsPerBar: number): BarChords[] {
  return text
    .split("|")
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const chords = b.split(/\s+/).filter(Boolean);
      if (chords.length === 1) return chords[0];
      const each = beatsPerBar / chords.length;
      return chords.map((c) => [c, each] as [string, number]);
    });
}

export function chordChartText(bars: BarChords[]): string {
  return bars.map((b) => (typeof b === "string" ? b : b.map(([c]) => c).join(" "))).join(" | ");
}
