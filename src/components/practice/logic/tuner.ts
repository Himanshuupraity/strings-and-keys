import { EN, type MessageKey } from "@/lib/i18n/en";
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

/** Plain-language advice for a beginner, as a translatable message (format it in the UI). */
export function tuningAdviceMessage(cents: number): { key: MessageKey; vars?: Record<string, string>; amountKey?: MessageKey } {
  const s = classifyCents(cents);
  if (s === "in-tune") return { key: "tuner.inTune" };
  const abs = Math.abs(cents);
  if (abs > 250) return { key: cents < 0 ? "tuner.farLow" : "tuner.farHigh" };
  const amountKey: MessageKey = abs > 50 ? "tuner.amount.fair" : abs > 15 ? "tuner.amount.little" : "tuner.amount.slight";
  return { key: s === "flat" ? "tuner.flat" : "tuner.sharp", amountKey };
}

/** English form of tuningAdviceMessage. */
export function tuningAdvice(cents: number): string {
  const m = tuningAdviceMessage(cents);
  return EN[m.key].replace("{amount}", m.amountKey ? EN[m.amountKey] : "");
}

/** Map cents (-50..50, clamped) to a needle angle in degrees (-60..60). */
export function needleAngle(cents: number): number {
  const c = Math.max(-50, Math.min(50, cents));
  return (c / 50) * 60;
}
