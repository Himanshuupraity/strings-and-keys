import { compareChordTones } from "@/lib/music/chords";
import { STANDARD_TUNING, stringNumber } from "@/lib/music/guitar";
import { midiToName, mod12, pcName } from "@/lib/music/notes";
import type { MessageKey } from "@/lib/i18n/en";
import { enText, type I18nMessage } from "@/lib/i18n/messages";

/**
 * Turns MEASURED input (a played MIDI note, an optional cents offset from the mic, or a set of
 * pitch classes) into specific, honest feedback. Pure — no audio, no React.
 * Every text comes as a translatable message (`*Msg`); the plain fields are its English text.
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
  link?: { href: string; label: string; labelKey?: MessageKey };
  titleMsg?: I18nMessage;
  detailMsg?: I18nMessage;
  tipMsg?: I18nMessage;
}

type Unit = "semitone" | "octave" | "fret" | "key" | "exercise";
/** "1 semitone" / "2 semitones" as a nested message. */
const unit = (n: number, u: Unit): I18nMessage => ({ key: `unit.${u}.${n === 1 ? "one" : "many"}` as MessageKey, vars: { n } });
const m = (key: MessageKey, vars?: I18nMessage["vars"]): I18nMessage => ({ key, vars });

/** Build a Feedback whose English fields mirror its messages. */
function fb(verdict: FeedbackVerdict, titleMsg: I18nMessage, detailMsg: I18nMessage, tipMsg?: I18nMessage, link?: { href: string; labelKey: MessageKey }): Feedback {
  return {
    verdict,
    title: enText(titleMsg),
    detail: enText(detailMsg),
    tip: tipMsg && enText(tipMsg),
    link: link && { href: link.href, label: enText({ key: link.labelKey }), labelKey: link.labelKey },
    titleMsg,
    detailMsg,
    tipMsg,
  };
}

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
  const guitar = opts.instrument === "guitar";

  if (played === target) {
    if (fromMic && opts.cents !== undefined && Math.abs(opts.cents) > IN_TUNE_CENTS) {
      const sharp = opts.cents > 0;
      const cents = Math.round(Math.abs(opts.cents));
      return fb(
        "close",
        m(sharp ? "coach.fb.rightSharp" : "coach.fb.rightFlat", { note: t, cents }),
        m(guitar ? (sharp ? "coach.fb.offGuitarAbove" : "coach.fb.offGuitarBelow") : sharp ? "coach.fb.offPianoAbove" : "coach.fb.offPianoBelow"),
        m(guitar ? "coach.fb.tipTuner" : "coach.fb.tipA4"),
        guitar ? { href: "/tuner", labelKey: "coach.fb.openTuner" } : { href: "/settings", labelKey: "coach.fb.tuningRef" },
      );
    }
    const c = opts.cents !== undefined ? Math.round(opts.cents) : 0;
    return fb("correct", m("coach.fb.yes", { note: t }), fromMic && opts.cents !== undefined ? m("coach.fb.measuredCents", { cents: `${c >= 0 ? "+" : ""}${c}` }) : m("coach.fb.exactNote"));
  }

  const diff = played - target;
  const higher = diff > 0;

  if (mod12(played) === mod12(target)) {
    const oct = Math.abs(diff) / 12;
    return fb(
      "octave",
      m(higher ? "coach.fb.octaveHigher" : "coach.fb.octaveLower", { octaves: unit(oct, "octave") }),
      m(higher ? "coach.fb.octaveDetailHigher" : "coach.fb.octaveDetailLower", { played: p, target: t }),
      opts.instrument === "piano"
        ? target === 60
          ? m("coach.fb.middleCTip")
          : m(oct === 1 ? (higher ? "coach.fb.moveOneGroupLeft" : "coach.fb.moveOneGroupRight") : higher ? "coach.fb.moveFewLeft" : "coach.fb.moveFewRight")
        : m(higher ? "coach.fb.thickerString" : "coach.fb.thinnerString"),
    );
  }

  const n = Math.abs(diff);
  let detail = m(higher ? "coach.fb.measuredHigher" : "coach.fb.measuredLower", { played: p, semis: unit(n, "semitone"), target: t });
  let tip: I18nMessage | undefined;
  if (guitar) {
    const open = openStringFor(played);
    const targetOpen = openStringFor(target);
    if (open !== null && targetOpen !== null) {
      detail = m(higher ? "coach.fb.openStringHigher" : "coach.fb.openStringLower", { name: pcName(STANDARD_TUNING[open]), n: stringNumber(open), semis: unit(n, "semitone"), target: t });
      tip = t === "E4" ? m("coach.fb.highETip") : m("coach.fb.lookForString", { n: stringNumber(targetOpen) });
    } else if (n <= 2 && fromMic) {
      tip = m("coach.fb.veryClose");
    } else {
      tip = n <= 4 ? m(higher ? "coach.fb.moveFretsHeadstock" : "coach.fb.moveFretsBody", { frets: unit(n, "fret") }) : m("coach.fb.checkString");
    }
  } else {
    tip = n <= 4 ? m(higher ? "coach.fb.moveKeysLeft" : "coach.fb.moveKeysRight", { keys: unit(n, "key") }) : m("coach.fb.lookForNote", { note: pcName(target) });
  }
  return fb("wrong", m("coach.fb.notQuite", { note: p }), detail, tip);
}

export function uncertainFeedback(reason: "unclear" | "noisy" | "quiet" = "unclear"): Feedback {
  return fb(
    "uncertain",
    m("coach.fb.unclearTitle"),
    m(reason === "quiet" ? "coach.fb.quiet" : reason === "noisy" ? "coach.fb.noisy" : "coach.fb.unclear"),
    m("coach.fb.unclearTip"),
  );
}

/** Chord check from pitch classes heard/held. `confidence` (0–1) only for mic estimates. */
export function analyzeChord(chord: string, pcs: number[], opts: { source: "virtual" | "midi" | "mic"; confidence?: number }): Feedback & { coverage: number } {
  if (opts.source === "mic" && (opts.confidence ?? 0) < 0.45) {
    return { ...fb("uncertain", m("coach.fb.unclearTitle"), m("coach.fb.chordMicUnsure"), m("coach.fb.chordMicUnsureTip")), coverage: 0 };
  }
  const r = compareChordTones(chord, pcs);
  const missing = r.missing.map(r.name);
  const unwanted = r.unwanted.map(r.name);
  const mic = opts.source === "mic";
  const tones = r.expected.map(r.name).join(", ");
  if (missing.length === 0 && unwanted.length === 0) {
    return { ...fb("correct", m("coach.fb.chordYes", { chord }), m(mic ? "coach.fb.chordAllMic" : "coach.fb.chordAll", { tones })), coverage: 1 };
  }
  const parts: I18nMessage[] = [];
  if (missing.length) parts.push(m("coach.fb.missingNotes", { notes: missing.join(", ") }));
  if (unwanted.length) parts.push(m("coach.fb.extraNotes", { notes: unwanted.join(", "), chord }));
  const partsMsg = parts.length === 2 ? m("coach.fb.twoParts", { a: parts[0], b: parts[1] }) : parts[0];
  const heard = pcs.length ? Array.from(new Set(pcs.map(mod12))).map(r.name).join(", ") : "";
  const detailKey: MessageKey = mic ? (heard ? "coach.fb.chordNeedsHeardMic" : "coach.fb.chordNeedsNothingMic") : heard ? "coach.fb.chordNeedsGot" : "coach.fb.chordNeedsNothing";
  return {
    ...fb(
      missing.length === 0 || r.coverage >= 0.66 ? "close" : "wrong",
      r.coverage >= 0.66 ? m("coach.fb.almost", { parts: partsMsg }) : m("coach.fb.notChordYet", { chord }),
      m(detailKey, { chord, tones, heard }),
      opts.source === "mic" || opts.source === "virtual"
        ? m(missing.length ? "coach.fb.mutedStringTip" : "coach.fb.extraStringTip")
        : missing.length
          ? m("coach.fb.addNotes", { notes: missing.join(" and ") })
          : m("coach.fb.liftNotes", { notes: unwanted.join(" and ") }),
    ),
    coverage: r.coverage,
  };
}

/** Summarise a set of measured results as practice feedback (translatable lines). */
export function summarizeResultsMessages(results: { title: string; accuracy: number; measured: boolean }[]): I18nMessage[] {
  if (!results.length) return [m("coach.sum.none")];
  const measured = results.filter((r) => r.measured);
  const avg = measured.length ? measured.reduce((a, r) => a + r.accuracy, 0) / measured.length : null;
  const best = [...results].sort((a, b) => b.accuracy - a.accuracy)[0];
  const weakest = [...results].sort((a, b) => a.accuracy - b.accuracy)[0];
  const lines = [avg !== null ? m("coach.sum.triedAvg", { exercises: unit(results.length, "exercise"), pct: Math.round(avg * 100) }) : m("coach.sum.tried", { exercises: unit(results.length, "exercise") })];
  lines.push(m("coach.sum.strongest", { title: best.title, pct: Math.round(best.accuracy * 100) }));
  if (weakest !== best && weakest.accuracy < 0.8) lines.push(m("coach.sum.repeat", { title: weakest.title, pct: Math.round(weakest.accuracy * 100) }));
  return lines;
}

/** English form of summarizeResultsMessages. */
export function summarizeResults(results: { title: string; accuracy: number; measured: boolean }[]): string {
  return summarizeResultsMessages(results).map(enText).join(" ");
}
