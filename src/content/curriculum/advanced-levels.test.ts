import { describe, expect, it } from "vitest";
import type { AudioExample, Exercise, Lesson, Visual } from "../types";
import { LEVEL_4 } from "./level-4";
import { LEVEL_5, LEVEL_5_FACTS } from "./level-5";
import { LEVEL_6, LEVEL_6_FACTS } from "./level-6";
import { LEVEL_7 } from "./level-7";
import { LESSONS } from "./index";
import { chordPitchClasses, parseChord } from "@/lib/music/chords";
import { nameToMidi, midiToName } from "@/lib/music/notes";
import { scaleNoteNames } from "@/lib/music/scales";

const MINE: Lesson[] = [...LEVEL_4, ...LEVEL_5, ...LEVEL_6, ...LEVEL_7];

/** Ids owned by the levels 0–3 author that we depend on. */
const EXTERNAL = new Set(["l0-piano-setup", "l1-musical-alphabet", "l1-octaves-chromatic", "l1-treble-bass-clef", "l1-note-durations", "l1-tempo-metronome", "g3-riffs-melodies"]);

const toMidi = (n: number | string) => (typeof n === "number" ? n : nameToMidi(n));

function notesOfAudio(a: AudioExample): (number | string)[] {
  if (a.type === "notes") return a.notes;
  if (a.type === "compare") return [...a.a, ...a.b];
  return [];
}
function chordsOfAudio(a: AudioExample): string[] {
  if (a.type === "chord") return [a.chord];
  if (a.type === "chords") return a.chords;
  return [];
}
function checkVisual(v: Visual) {
  if (v.type === "keyboard") v.highlight?.forEach((n) => expect(Number.isFinite(toMidi(n))).toBe(true));
  if (v.type === "chord-diagram") v.chords.forEach((c) => expect(parseChord(c), c).not.toBeNull());
  if (v.type === "staff") v.notes.forEach((n) => n.note !== "rest" && expect(Number.isFinite(nameToMidi(n.note))).toBe(true));
  if (v.type === "fretboard") v.highlight?.forEach((h) => { expect(h.string).toBeGreaterThanOrEqual(0); expect(h.string).toBeLessThanOrEqual(5); expect(h.fret).toBeGreaterThanOrEqual(0); });
}
function checkExercise(e: Exercise) {
  switch (e.type) {
    case "play-sequence":
      expect(e.notes.length).toBeGreaterThan(0);
      e.notes.forEach((n) => expect(Number.isFinite(toMidi(n))).toBe(true));
      if (e.fingers) {
        expect(e.fingers).toHaveLength(e.notes.length);
        e.fingers.forEach((f) => expect(f >= 1 && f <= 5).toBe(true));
      }
      break;
    case "play-chord":
      expect(() => chordPitchClasses(e.chord)).not.toThrow();
      break;
    case "find-all":
      expect(e.pitchClass >= 0 && e.pitchClass <= 11).toBe(true);
      break;
    case "tap-rhythm":
      e.pattern.forEach((p) => expect(p >= 0 && p < e.bars * e.beatsPerBar).toBe(true));
      break;
    case "name-note":
      e.notes.forEach((n) => expect(Number.isFinite(toMidi(n))).toBe(true));
      break;
    case "mic-note":
      expect(Number.isFinite(nameToMidi(e.note))).toBe(true);
      break;
    case "ear-choice":
      expect(e.rounds).toBeGreaterThan(0);
  }
}

describe("curriculum levels 4–7", () => {
  it("has lessons at every level with unique ids", () => {
    expect(LEVEL_4.length).toBeGreaterThanOrEqual(15);
    expect(LEVEL_5.length).toBeGreaterThanOrEqual(18);
    expect(LEVEL_6.length).toBeGreaterThanOrEqual(16);
    expect(LEVEL_7.length).toBeGreaterThanOrEqual(12);
    const ids = MINE.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("p4-two-hands");
  });

  it("levels and id prefixes match tracks", () => {
    for (const l of MINE) {
      if (l.id.startsWith("p")) expect(l.track).toBe("piano");
      if (l.id.startsWith("g")) expect(l.track).toBe("guitar");
      if (l.id.startsWith("t")) expect(l.track).toBe("theory");
      expect(Number(l.id[1])).toBe(l.level);
    }
  });

  it("prerequisites exist (or are owned by levels 0–3) and point to earlier/equal levels", () => {
    const all = new Map([...LESSONS, ...MINE].map((l) => [l.id, l]));
    for (const l of MINE) {
      for (const p of l.prerequisites) {
        const pre = all.get(p);
        expect(pre || EXTERNAL.has(p), `${l.id} -> ${p}`).toBeTruthy();
        if (pre) expect(pre.level).toBeLessThanOrEqual(l.level);
      }
    }
  });

  it("every lesson has real steps, an interactive exercise, a quiz and valid music data", () => {
    for (const l of MINE) {
      expect(l.steps.length, l.id).toBeGreaterThanOrEqual(3);
      const stepIds = l.steps.map((s) => s.id);
      expect(new Set(stepIds).size, l.id).toBe(stepIds.length);
      expect(l.steps.some((s) => s.kind === "exercise"), l.id).toBe(true);
      expect(l.quiz.length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.quiz.length, l.id).toBeLessThanOrEqual(6);
      for (const qq of l.quiz) {
        expect(qq.answer >= 0 && qq.answer < qq.options.length, `${l.id}/${qq.id}`).toBe(true);
        expect(qq.explanation.length).toBeGreaterThan(5);
      }
      for (const s of l.steps) {
        if ("audio" in s && s.audio) {
          notesOfAudio(s.audio).forEach((n) => expect(Number.isFinite(toMidi(n)), `${l.id}/${s.id}`).toBe(true));
          chordsOfAudio(s.audio).forEach((c) => expect(() => chordPitchClasses(c), `${l.id}/${s.id} ${c}`).not.toThrow());
        }
        if ("visual" in s && s.visual) checkVisual(s.visual);
        if (s.kind === "exercise") checkExercise(s.exercise);
      }
    }
  });

  it("key musical facts used in lessons are correct", () => {
    expect(LEVEL_5_FACTS.A_HARM_MINOR.map((m) => midiToName(m))).toEqual(["A3", "B3", "C4", "D4", "E4", "F4", "G#4", "A4"]);
    expect(LEVEL_5_FACTS.A_MEL_MINOR.map((m) => midiToName(m))).toEqual(["A3", "B3", "C4", "D4", "E4", "F#4", "G#4", "A4"]);
    expect(LEVEL_5_FACTS.C_MAJ_PENTA.map((m) => midiToName(m))).toEqual(["C4", "D4", "E4", "G4", "A4", "C5"]);
    expect(scaleNoteNames("F", "major")).toContain("Bb");
    // Pentatonic box 1 at fret 5 contains only A C D E G.
    expect(new Set(LEVEL_6_FACTS.PENTA_BOX_MIDI.map((m) => midiToName(m).replace(/\d/g, "")))).toEqual(new Set(["A", "C", "D", "E", "G"]));
    expect(LEVEL_6_FACTS.C_ARPEGGIO.map((m) => midiToName(m))).toEqual(["C3", "E3", "G3", "C4", "E4"]);
    // A7 is V of Dm, E7 is V of Am
    expect(chordPitchClasses("A7")).toContain(1);
    expect(chordPitchClasses("G7sus4").sort((a, b) => a - b)).toEqual([0, 2, 5, 7]);
  });

  it("mastery exercises exist so mastery is achievable", () => {
    const withMastery = MINE.filter((l) => l.steps.some((s) => s.kind === "exercise" && s.mastery));
    expect(withMastery.length / MINE.length).toBeGreaterThan(0.85);
  });
});
