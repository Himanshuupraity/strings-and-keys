import { scaleMidi, type ScaleTypeId } from "@/lib/music/scales";

/** Ascending then descending scale notes, positioned for the instrument. */
export function scaleRun(tonic: string, type: ScaleTypeId, instrument: "guitar" | "piano", direction: "up" | "up-down"): number[] {
  // Guitar: lowest octave with root on/above low E (E2 = 40). Piano: octave 4 (middle C region).
  let octave = instrument === "guitar" ? 2 : 4;
  let notes = scaleMidi(tonic, type, octave);
  while (instrument === "guitar" && notes[0] < 40) notes = scaleMidi(tonic, type, ++octave);
  return direction === "up" ? notes : [...notes, ...notes.slice(0, -1).reverse()];
}

/** Evenness of note timing: mean and spread of gaps between notes (ms). */
export function timingEvenness(timesMs: number[], targetGapMs?: number) {
  if (timesMs.length < 3) return null;
  const gaps = timesMs.slice(1).map((t, i) => t - timesMs[i]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
  const ref = targetGapMs ?? mean;
  const meanErr = gaps.reduce((a, g) => a + Math.abs(g - ref), 0) / gaps.length;
  return { mean, sd, meanErr, steadiness: Math.max(0, 1 - sd / mean) };
}
