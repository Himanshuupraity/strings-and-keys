import { centsBetween, frequencyToMidiFloat, midiToFrequency } from "@/lib/music/notes";

export type TuneState = "in-tune" | "flat" | "sharp";

/** ±5 cents counts as in tune. */
export const IN_TUNE_CENTS = 5;

/** Index of the tuning string whose open pitch is closest to the frequency. */
export function nearestString(freq: number, tuning: number[], a4 = 440): number {
  const m = frequencyToMidiFloat(freq, a4);
  let best = 0;
  let bestD = Infinity;
  tuning.forEach((t, i) => {
    const d = Math.abs(m - t);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export function centsFromTarget(freq: number, targetMidi: number, a4 = 440): number {
  return centsBetween(freq, midiToFrequency(targetMidi, a4));
}

export function classifyCents(cents: number, tolerance = IN_TUNE_CENTS): TuneState {
  if (Math.abs(cents) <= tolerance) return "in-tune";
  return cents < 0 ? "flat" : "sharp";
}

/** Plain-language advice for a beginner. */
export function tuningAdvice(cents: number): string {
  const s = classifyCents(cents);
  if (s === "in-tune") return "In tune — nice! Move on to the next string.";
  const abs = Math.abs(cents);
  if (abs > 250) return cents < 0
    ? "Far too low — you may be on the wrong string, or it's very slack. Tighten slowly and re-check."
    : "Far too high — you may be on the wrong string. Loosen slowly so the string doesn't snap.";
  const amount = abs > 50 ? "a fair bit" : abs > 15 ? "a little" : "very slightly";
  return s === "flat" ? `Too low (flat). Tighten the string ${amount}.` : `Too high (sharp). Loosen the string ${amount}.`;
}

/** Map cents (-50..50, clamped) to a needle angle in degrees (-60..60). */
export function needleAngle(cents: number): number {
  const c = Math.max(-50, Math.min(50, cents));
  return (c / 50) * 60;
}
