import { describe, expect, it } from "vitest";
import { chromaFromSpectrum } from "./microphone";
import { midiToFrequency } from "@/lib/music/notes";

function spectrum(midis: number[], binHz = 48000 / 8192, bins = 4096) {
  const db = new Float32Array(bins).fill(-120);
  for (const m of midis) {
    const f = midiToFrequency(m);
    const i = Math.round(f / binHz);
    db[i] = -10;
  }
  return { db, binHz };
}

describe("chroma chord estimate", () => {
  it("recognises a clean synthetic C major", () => {
    const { db, binHz } = spectrum([48, 52, 55, 60, 64]);
    const r = chromaFromSpectrum(db, binHz);
    expect(r.best?.symbol).toBe("C");
    expect(r.activePcs.sort()).toEqual([0, 4, 7]);
  });
  it("reports zero confidence for silence", () => {
    const r = chromaFromSpectrum(new Float32Array(4096).fill(-140), 48000 / 8192);
    expect(r.best).toBeNull();
    expect(r.confidence).toBe(0);
  });
});
