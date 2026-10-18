import { describe, expect, it } from "vitest";
import { LESSONS } from "./index";
import { LEVEL_0 } from "./level-0";
import { LEVEL_1 } from "./level-1";
import { LEVEL_2 } from "./level-2";
import { LEVEL_3 } from "./level-3";
import { nameToMidi } from "@/lib/music/notes";
import { chordPitchClasses, easiestShape, parseChord, shapePitchClasses } from "@/lib/music/chords";
import type { AudioExample, Exercise, Lesson, Visual } from "../types";

const OWN: Lesson[] = [...LEVEL_0, ...LEVEL_1, ...LEVEL_2, ...LEVEL_3];
const ids = new Set(LESSONS.map((l) => l.id));
const note = (n: number | string) => (typeof n === "number" ? n : nameToMidi(n));

function checkAudio(a: AudioExample | undefined, where: string) {
  if (!a) return;
  if (a.type === "notes") a.notes.forEach((n) => expect(() => note(n), where).not.toThrow());
  if (a.type === "compare") [...a.a, ...a.b].forEach((n) => expect(() => note(n), where).not.toThrow());
  if (a.type === "chord") expect(parseChord(a.chord), where).not.toBeNull();
  if (a.type === "chords") a.chords.forEach((c) => expect(parseChord(c), `${where} ${c}`).not.toBeNull());
  if (a.type === "rhythm") expect(a.pattern.length).toBeGreaterThan(0);
}

function checkVisual(v: Visual | undefined, where: string) {
  if (!v) return;
  if (v.type === "keyboard") (v.highlight ?? []).forEach((n) => expect(() => note(n), where).not.toThrow());
  if (v.type === "staff") v.notes.forEach((n) => n.note === "rest" || expect(() => nameToMidi(n.note), where).not.toThrow());
  if (v.type === "chord-diagram") v.chords.forEach((c) => expect(easiestShape(c), `${where} diagram ${c}`).toBeDefined());
  if (v.type === "fretboard") (v.highlight ?? []).forEach((h) => expect(h.string >= 0 && h.string <= 5 && h.fret >= 0, where).toBe(true));
  if (v.type === "tab") expect(v.lines).toHaveLength(6);
}

function checkExercise(e: Exercise, where: string) {
  switch (e.type) {
    case "play-sequence":
      expect(e.notes.length, where).toBeGreaterThan(0);
      e.notes.forEach((n) => expect(() => note(n), where).not.toThrow());
      // Guitar targets must be playable in standard tuning within 12 frets.
      if (e.instrument === "guitar") e.notes.forEach((n) => expect(note(n) >= 40 && note(n) <= 76, `${where} ${n}`).toBe(true));
      break;
    case "play-chord":
      expect(parseChord(e.chord), where).not.toBeNull();
      if (e.instrument === "guitar") {
        const shape = easiestShape(e.chord)!;
        expect(shape, where).toBeDefined();
        expect(shapePitchClasses(shape).every((p) => chordPitchClasses(e.chord).includes(p)), where).toBe(true);
      }
      break;
    case "name-note":
      e.notes.forEach((n) => expect(() => note(n), where).not.toThrow());
      break;
    case "mic-note":
      expect(() => nameToMidi(e.note), where).not.toThrow();
      break;
    case "find-all":
      expect(e.pitchClass >= 0 && e.pitchClass < 12).toBe(true);
      break;
    case "tap-rhythm":
      e.pattern.forEach((p) => expect(p >= 0 && p < e.beatsPerBar, where).toBe(true));
      break;
    case "ear-choice":
      expect(e.rounds).toBeGreaterThan(0);
      break;
  }
}

describe("curriculum", () => {
  it("has unique lesson ids", () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });
  it("prerequisites reference existing lessons and are not circular", () => {
    for (const l of LESSONS) for (const p of l.prerequisites) expect(ids.has(p), `${l.id} -> ${p}`).toBe(true);
    const visit = (id: string, seen: Set<string>): void => {
      expect(seen.has(id), `cycle at ${id}`).toBe(false);
      const l = LESSONS.find((x) => x.id === id)!;
      l.prerequisites.forEach((p) => visit(p, new Set([...seen, id])));
    };
    LESSONS.forEach((l) => visit(l.id, new Set()));
  });
  it("contains the required ids for levels 0–3", () => {
    const required = [
      "l0-what-is-music", "l0-sound-and-pitch", "l0-notes", "l0-high-low", "l0-rhythm-tempo", "l0-how-to-practice", "l0-vocabulary", "l0-guitar-setup", "l0-piano-setup", "l0-using-the-app",
      "l1-musical-alphabet", "l1-sharps-flats", "l1-semitones-tones", "l1-octaves-chromatic", "l1-pitch-recognition", "l1-note-durations", "l1-rests-counting", "l1-bars-time-signatures", "l1-tempo-metronome", "l1-notation-intro", "l1-treble-bass-clef", "l1-dynamics-articulation",
      "g2-first-songs", "g3-riffs-melodies",
    ];
    for (const id of required) expect(ids.has(id), id).toBe(true);
  });
  it("every lesson has steps, an interactive exercise and a valid quiz", () => {
    for (const l of OWN) {
      expect(l.steps.length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.steps.some((s) => s.kind === "exercise"), l.id).toBe(true);
      expect(l.quiz.length, l.id).toBeGreaterThanOrEqual(3);
      expect(new Set(l.steps.map((s) => s.id)).size, `${l.id} step ids`).toBe(l.steps.length);
      for (const qq of l.quiz) {
        expect(qq.answer >= 0 && qq.answer < qq.options.length, `${l.id}/${qq.id}`).toBe(true);
        expect(qq.explanation.length).toBeGreaterThan(0);
      }
      expect(l.passScore > 0 && l.passScore <= 1).toBe(true);
    }
  });
  it("all notes, chords, visuals and exercises parse and are musically valid", () => {
    for (const l of OWN)
      for (const s of l.steps) {
        const where = `${l.id}/${s.id}`;
        if ("audio" in s) checkAudio(s.audio, where);
        if ("visual" in s) checkVisual(s.visual, where);
        if (s.kind === "exercise") checkExercise(s.exercise, where);
      }
  });
  it("mastery exercises exist on at least half of instrument lessons", () => {
    const inst = OWN.filter((l) => l.track !== "theory");
    const withMastery = inst.filter((l) => l.steps.some((s) => s.kind === "exercise" && s.mastery));
    expect(withMastery.length / inst.length).toBeGreaterThanOrEqual(0.5);
  });
  it("lesson counts per level", () => {
    expect(LEVEL_0.length).toBe(10);
    expect(LEVEL_1.length).toBe(12);
    expect(LEVEL_2.length).toBeGreaterThanOrEqual(18);
    expect(LEVEL_3.length).toBeGreaterThanOrEqual(14);
  });
});
