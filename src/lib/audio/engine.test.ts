import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { PIANO_SAMPLE_NOTES, nearestSampleDistance, pianoSampleFile, pianoSampleUrls } from "./engine";

describe("recorded piano sample map", () => {
  it("covers every key of an 88-key piano within 1 semitone of a real recording", () => {
    for (let midi = 21; midi <= 108; midi++) expect(nearestSampleDistance(midi), `MIDI ${midi}`).toBeLessThanOrEqual(1);
  });

  it("has 30 samples from A0 to C8 with file names Tone.js expects", () => {
    expect(PIANO_SAMPLE_NOTES).toHaveLength(30);
    expect(PIANO_SAMPLE_NOTES[0]).toBe("A0");
    expect(PIANO_SAMPLE_NOTES.at(-1)).toBe("C8");
    expect(pianoSampleFile("D#4")).toBe("Ds4.mp3");
    expect(pianoSampleUrls()["F#2"]).toBe("Fs2.mp3");
  });

  it("every sample file and the licence are shipped in public/samples/piano", () => {
    const dir = path.resolve(process.cwd(), "public/samples/piano");
    for (const n of PIANO_SAMPLE_NOTES) expect(existsSync(path.join(dir, pianoSampleFile(n))), n).toBe(true);
    expect(existsSync(path.join(dir, "LICENSE.txt"))).toBe(true);
  });
});
