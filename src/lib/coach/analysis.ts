import { compareChordTones } from "@/lib/music/chords";
import { STANDARD_TUNING, stringNumber } from "@/lib/music/guitar";
import { midiToName, mod12, pcName } from "@/lib/music/notes";

/**
 * Turns MEASURED input (a played MIDI note, an optional cents offset from the mic, or a set of
 * pitch classes) into specific, honest feedback. Pure — no audio, no React.
 */

export type FeedbackVerdict = "correct" | "close" | "octave" | "wrong" | "uncertain";

export interface Feedback {
  verdict: FeedbackVerdict;
  /** Headline shown big. */
  title: string;
  /** Specific explanation. */
  detail: string;
  /** Optional practical next step ("Open the tuner", "Press closer to the fret"). */
  tip?: string;
  /** Link suggestion, e.g. "/tuner". */
  link?: { href: string; label: string };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Which open string (index) a MIDI note matches exactly, if any. */
export function openStringFor(midi: number, tuning = STANDARD_TUNING): number | null {
  const i = tuning.indexOf(midi);
  return i === -1 ? null : i;
}

/** Tolerance (cents) within which a mic note counts as in tune. */
export const IN_TUNE_CENTS = 15;

export function analyzeNote(target: number, played: number, opts: { instrument: "guitar" | "piano"; cents?: number; source?: "virtual" | "midi" | "mic" }): Feedback {
  const t = midiToName(target);
  const p = midiToName(played);
  const fromMic = opts.source === "mic";

  if (played === target) {
    if (fromMic && opts.cents !== undefined && Math.abs(opts.cents) > IN_TUNE_CENTS) {
      const dir = opts.cents > 0 ? "sharp (a little high)" : "flat (a little low)";
      const cents = Math.round(Math.abs(opts.cents));
      return {
        verdict: "close",
        title: `Right note — ${t} — but ${cents} cents ${dir}`,
        detail:
          opts.instrument === "guitar"
            ? `The pitch is the correct note, just slightly ${opts.cents > 0 ? "above" : "below"} perfect tuning. That usually means the string itself needs a small tuning adjustment, or you pressed very hard on a fret.`
            : `The pitch is the correct note, just slightly ${opts.cents > 0 ? "above" : "below"} standard tuning (A4 = 440 Hz). Acoustic pianos drift over time; a digital keyboard may have a transpose/tune setting.`,
        tip: opts.instrument === "guitar" ? "Check this string with the tuner, then play it again." : "If every note reads off by the same amount, check the A4 reference in Settings.",
        link: opts.instrument === "guitar" ? { href: "/tuner", label: "Open the tuner" } : { href: "/settings", label: "Tuning reference" },
      };
    }
    return { verdict: "correct", title: `Yes! That's ${t}.`, detail: fromMic && opts.cents !== undefined ? `Measured ${Math.round(opts.cents) >= 0 ? "+" : ""}${Math.round(opts.cents)} cents from perfect — nicely in tune.` : `You played exactly the right note.` };
  }

  const diff = played - target;
  const dir = diff > 0 ? "higher" : "lower";

  if (mod12(played) === mod12(target)) {
    const oct = Math.abs(diff) / 12;
    return {
      verdict: "octave",
      title: `Right note name, ${plural(oct, "octave")} ${dir}`,
      detail: `You played ${p}. It's the same letter as ${t} but in a different octave — it sounds ${dir}.`,
      tip:
        opts.instrument === "piano"
          ? target === 60
            ? "Middle C is the C just to the left of the pair of black keys nearest the middle of the keyboard (under the brand name on most pianos)."
            : `Move ${oct === 1 ? "one group of 12 keys" : "a few octaves"} ${diff > 0 ? "to the left" : "to the right"}.`
          : `Try the same note on a ${diff > 0 ? "thicker string or lower fret" : "thinner string or higher fret"}.`,
    };
  }

  const n = Math.abs(diff);
  let detail = `I measured ${p}, which is ${plural(n, "semitone")} ${dir} than ${t}.`;
  let tip: string | undefined;
  if (opts.instrument === "guitar") {
    const open = openStringFor(played);
    const targetOpen = openStringFor(target);
    if (open !== null && targetOpen !== null) {
      detail = `That sounded like the open ${pcName(STANDARD_TUNING[open])} string (string ${stringNumber(open)}) — ${plural(n, "semitone")} ${dir} than ${t}.`;
      tip = `${t === "E4" ? "The high E is the thinnest string, closest to the floor when you hold the guitar." : `Look for string ${stringNumber(targetOpen)}.`} Pick only that one string.`;
    } else if (n <= 2 && fromMic) {
      tip = "Very close — if you were playing the right string and fret, the string may be out of tune. Check with the tuner.";
    } else {
      tip = n <= 4 ? `Move ${plural(n, "fret")} ${diff > 0 ? "towards the headstock" : "towards the body"} on the same string.` : "Check you're on the right string, then count the frets again.";
    }
  } else {
    tip = n <= 4 ? `Move ${plural(n, "key")} (counting black and white keys) ${diff > 0 ? "to the left" : "to the right"}.` : `Look for ${pcName(target)} — use the pattern of 2 and 3 black keys to find it.`;
  }
  return { verdict: "wrong", title: `Not quite — that was ${p}`, detail, tip };
}

export function uncertainFeedback(reason: "unclear" | "noisy" | "quiet" = "unclear"): Feedback {
  const detail =
    reason === "quiet"
      ? "I could barely hear anything. Move the device closer to your instrument and play a little louder."
      : reason === "noisy"
        ? "There's too much background sound for me to pick out a clear note."
        : "I heard sound, but not a clear, steady pitch — so I won't guess.";
  return {
    verdict: "uncertain",
    title: "I couldn't hear that clearly",
    detail,
    tip: "Play one note at a time, let it ring for a second, and keep other sounds quiet. Then try again.",
  };
}

/** Chord check from pitch classes heard/held. `confidence` (0–1) only for mic estimates. */
export function analyzeChord(chord: string, pcs: number[], opts: { source: "virtual" | "midi" | "mic"; confidence?: number }): Feedback & { coverage: number } {
  if (opts.source === "mic" && (opts.confidence ?? 0) < 0.45) {
    return { ...uncertainFeedback("unclear"), detail: "Chords are hard to hear through a microphone — overtones and quiet strings get mixed up. I'm not confident enough to judge this one.", tip: "Strum again slowly and let it ring. Or confirm it yourself, or use a MIDI keyboard for a reliable check.", coverage: 0 };
  }
  const r = compareChordTones(chord, pcs);
  const missing = r.missing.map(r.name);
  const unwanted = r.unwanted.map(r.name);
  const hedge = opts.source === "mic" ? " (best-effort microphone estimate)" : "";
  if (missing.length === 0 && unwanted.length === 0) {
    return { verdict: "correct", title: `That's a ${chord} chord!`, detail: `All the chord tones (${r.expected.map(r.name).join(", ")}) were there and nothing extra${hedge}.`, coverage: 1 };
  }
  const parts: string[] = [];
  if (missing.length) parts.push(`missing ${missing.join(", ")}`);
  if (unwanted.length) parts.push(`extra ${unwanted.join(", ")} (not in ${chord})`);
  return {
    verdict: missing.length === 0 || r.coverage >= 0.66 ? "close" : "wrong",
    title: r.coverage >= 0.66 ? `Almost — ${parts.join("; ")}` : `Not ${chord} yet`,
    detail: `${chord} needs ${r.expected.map(r.name).join(", ")}. I ${opts.source === "mic" ? "heard" : "got"}: ${pcs.length ? Array.from(new Set(pcs.map(mod12))).map(r.name).join(", ") : "nothing"}${hedge}.`,
    tip: opts.source === "mic" || opts.source === "virtual" ? (missing.length ? "A missing note on guitar is often a muted string: arch your fingers so they don't touch neighbouring strings." : "An extra note often means you strummed a string that should be skipped.") : missing.length ? `Add ${missing.join(" and ")}.` : `Lift the ${unwanted.join(" and ")}.`,
    coverage: r.coverage,
  };
}

/** Summarise a set of measured results as practice feedback. */
export function summarizeResults(results: { title: string; accuracy: number; measured: boolean }[]): string {
  if (!results.length) return "No exercises yet — start with the first one when you're ready.";
  const measured = results.filter((r) => r.measured);
  const avg = measured.length ? measured.reduce((a, r) => a + r.accuracy, 0) / measured.length : null;
  const best = [...results].sort((a, b) => b.accuracy - a.accuracy)[0];
  const weakest = [...results].sort((a, b) => a.accuracy - b.accuracy)[0];
  const lines = [`You tried ${plural(results.length, "exercise")}${avg !== null ? `, with an average first-try accuracy of ${Math.round(avg * 100)}% (measured)` : ""}.`];
  lines.push(`Strongest: ${best.title} (${Math.round(best.accuracy * 100)}%).`);
  if (weakest !== best && weakest.accuracy < 0.8) lines.push(`Worth repeating: ${weakest.title} (${Math.round(weakest.accuracy * 100)}%).`);
  return lines.join(" ");
}
