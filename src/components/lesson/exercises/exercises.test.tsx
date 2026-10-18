import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PlaySequenceExercise, preferredPosition } from "./play-sequence";
import { judgeChord } from "./play-chord";
import { expectedHits } from "./tap-rhythm";
import { describePitch } from "./mic-note";
import { makeRounds } from "./ear-choice";
import { midiToName, nameToMidi } from "@/lib/music/notes";

vi.mock("@/lib/audio/engine", () => ({
  ensureAudio: vi.fn(async () => ({})),
  getAudioContext: () => null,
  playGuitarNote: vi.fn(async () => {}),
  pianoAttack: vi.fn(async () => {}),
  pianoRelease: vi.fn(),
  playNote: vi.fn(async () => {}),
  playPianoChord: vi.fn(async () => {}),
  strum: vi.fn(async () => {}),
}));

describe("exercise logic", () => {
  it("play-sequence completes via virtual piano clicks and reports accuracy", async () => {
    const onComplete = vi.fn();
    const { container } = render(<PlaySequenceExercise exercise={{ type: "play-sequence", instrument: "piano", notes: ["C4", "D4", "E4"], prompt: "x" }} instrument="piano" track="theory" onComplete={onComplete} />);
    const key = (m: number) => container.querySelector(`[data-midi="${m}"]`)!;
    for (const m of [60, 61, 62, 64]) {
      await act(async () => {
        fireEvent.pointerDown(key(m));
        fireEvent.pointerUp(key(m).parentElement!);
      });
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
    const o = onComplete.mock.calls[0][0];
    expect(o.correct).toBe(2);
    expect(o.total).toBe(3);
    expect(o.measured).toBe(true);
    expect(screen.getByText(/accuracy|almost there/i)).toBeTruthy();
  });
  it("play-sequence on guitar uses fretboard positions", async () => {
    const onComplete = vi.fn();
    const { container } = render(<PlaySequenceExercise exercise={{ type: "play-sequence", instrument: "guitar", notes: ["E4", "G4"], prompt: "x" }} instrument="guitar" track="guitar" onComplete={onComplete} />);
    await act(async () => fireEvent.pointerDown(container.querySelector('[data-string="5"][data-fret="0"]')!));
    await act(async () => fireEvent.pointerDown(container.querySelector('[data-string="5"][data-fret="3"]')!));
    expect(onComplete.mock.calls[0][0].accuracy).toBe(1);
  });
  it("preferred guitar positions are the lowest fret", () => {
    expect(preferredPosition(nameToMidi("E4"))).toMatchObject({ string: 5, fret: 0 });
    expect(preferredPosition(nameToMidi("C4"))).toMatchObject({ string: 4, fret: 1 });
    expect(preferredPosition(nameToMidi("E2"))).toMatchObject({ string: 0, fret: 0 });
  });
  it("judges chords", () => {
    expect(judgeChord("Em", [40, 47, 52, 55, 59, 64], 3).ok).toBe(true);
    const bad = judgeChord("C", [48, 52, 54], 3);
    expect(bad.ok).toBe(false);
    expect(bad.missing).toEqual([7]);
    expect(bad.unwanted).toEqual([6]);
    expect(judgeChord("A5", [45, 52], 2).ok).toBe(true);
  });
  it("computes expected tap times after a count-in", () => {
    expect(expectedHits({ pattern: [0, 2], bpm: 60, beatsPerBar: 4, bars: 2 })).toEqual([4000, 6000, 8000, 10000]);
  });
  it("describes pitch direction honestly", () => {
    expect(describePitch(64, 3, 64)).toBe("In tune!");
    expect(describePitch(64, 35, 64)).toMatch(/sharp/);
    expect(describePitch(62, 0, 64)).toMatch(/2 semitones lower/);
    expect(describePitch(52, 0, 64)).toMatch(/octave/);
  });
  it("ear rounds have valid answers", () => {
    for (const mode of ["high-low", "interval", "major-minor", "note-name", "swara"] as const) {
      const rounds = makeRounds({ type: "ear-choice", prompt: "", rounds: 20, mode }, 2);
      for (const r of rounds) expect(r.options).toContain(r.answer);
    }
    const swara = makeRounds({ type: "ear-choice", prompt: "", rounds: 10, mode: "swara", options: ["Sa"] }, 2);
    expect(swara.every((r) => r.play.kind === "seq" && midiToName(r.play.notes[0]) === "D4")).toBe(true);
  });
});
