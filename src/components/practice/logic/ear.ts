import { chordMidi } from "@/lib/music/chords";
import { mod12, pcName } from "@/lib/music/notes";
import { SWARAS } from "@/lib/music/sargam";
import { intervalName, SCALE_TYPES } from "@/lib/music/scales";
import { enText, type I18nMessage } from "@/lib/i18n/messages";

export type Rng = () => number;
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

export type EarMode = "high-low" | "match-note" | "major-minor" | "interval" | "melody" | "scale-note" | "swara";

export interface EarQuestion {
  mode: EarMode;
  prompt: string;
  /** What to play. `sequence` = notes one after another, `chord` = together. */
  play: { kind: "sequence" | "chord"; notes: number[] }[];
  options: string[];
  answer: string;
  /** For answers given on the keyboard (match-note, melody). */
  answerNotes?: number[];
  explanation: string;
  /** Translatable forms of prompt / explanation (the English fields above are their English text). */
  promptMsg: I18nMessage;
  explanationMsg: I18nMessage;
}

function q(base: Omit<EarQuestion, "prompt" | "explanation">): EarQuestion {
  return { ...base, prompt: enText(base.promptMsg), explanation: enText(base.explanationMsg) };
}

export function highLowQuestion(rng: Rng): EarQuestion {
  const a = int(rng, 55, 76);
  let diff = int(rng, 2, 9) * (rng() < 0.5 ? -1 : 1);
  if (a + diff < 48) diff = Math.abs(diff);
  const b = a + diff;
  const answer = b > a ? "Higher" : "Lower";
  return q({ mode: "high-low", promptMsg: { key: "ear.hl.prompt" }, play: [{ kind: "sequence", notes: [a, b] }], options: ["Higher", "Lower"], answer, explanationMsg: { key: answer === "Higher" ? "ear.hl.expHigher" : "ear.hl.expLower", vars: { n: Math.abs(diff) } } });
}

export function matchNoteQuestion(rng: Rng): EarQuestion {
  const n = int(rng, 60, 71);
  return q({ mode: "match-note", promptMsg: { key: "ear.match.prompt" }, play: [{ kind: "sequence", notes: [n] }], options: [], answer: pcName(n), answerNotes: [n], explanationMsg: { key: "ear.itWas", vars: { note: `${pcName(n)}4` } } });
}

export function majorMinorQuestion(rng: Rng): EarQuestion {
  const root = pick(rng, ["C", "D", "E", "F", "G", "A"]);
  const minor = rng() < 0.5;
  const sym = root + (minor ? "m" : "");
  const notes = chordMidi(sym, 4);
  return q({ mode: "major-minor", promptMsg: { key: "ear.mm.prompt" }, play: [{ kind: "chord", notes }, { kind: "sequence", notes }], options: ["Major", "Minor"], answer: minor ? "Minor" : "Major", explanationMsg: { key: minor ? "ear.mm.expMinor" : "ear.mm.expMajor", vars: { chord: sym } } });
}

export function intervalQuestion(rng: Rng, maxSemitones = 12): EarQuestion {
  const pool = [2, 3, 4, 5, 7, 9, 12].filter((s) => s <= maxSemitones);
  const semis = pick(rng, pool);
  const root = int(rng, 55, 67);
  const distractors = pool.filter((p) => p !== semis);
  const opts = new Set([semis]);
  while (opts.size < Math.min(4, pool.length)) opts.add(pick(rng, distractors));
  const options = [...opts].sort((a, b) => a - b).map(intervalName);
  return q({ mode: "interval", promptMsg: { key: "ear.int.prompt" }, play: [{ kind: "sequence", notes: [root, root + semis] }], options, answer: intervalName(semis), explanationMsg: { key: "ear.int.exp", vars: { name: intervalName(semis), n: semis } } });
}

export function melodyQuestion(rng: Rng, length = 3): EarQuestion {
  const scale = [60, 62, 64, 65, 67];
  const notes: number[] = [];
  let i = int(rng, 0, 2);
  for (let k = 0; k < length; k++) {
    notes.push(scale[i]);
    i = Math.max(0, Math.min(scale.length - 1, i + pick(rng, [-2, -1, 1, 2])));
  }
  return q({ mode: "melody", promptMsg: { key: "ear.mel.prompt", vars: { n: length } }, play: [{ kind: "sequence", notes }], options: [], answer: notes.map((n) => pcName(n)).join(" "), answerNotes: notes, explanationMsg: { key: "ear.mel.exp", vars: { notes: notes.map((n) => pcName(n)).join(" – ") } } });
}

export function scaleNoteQuestion(rng: Rng): EarQuestion {
  const intervals = SCALE_TYPES.major.intervals;
  const deg = int(rng, 1, 6);
  const notes = [60 + intervals[deg]];
  const names = ["Do (1)", "Re (2)", "Mi (3)", "Fa (4)", "So (5)", "La (6)", "Ti (7)"];
  return q({ mode: "scale-note", promptMsg: { key: "ear.deg.prompt" }, play: [{ kind: "sequence", notes: [60, 62, 64, 65, 67, 69, 71, 72] }, { kind: "sequence", notes }], options: names, answer: names[deg], explanationMsg: { key: "ear.deg.exp", vars: { note: pcName(notes[0]), d: deg + 1 } } });
}

/** Swara relative to the student's chosen Sa. Plays Sa first as a reference. */
export function swaraQuestion(rng: Rng, tonicPc: number, shuddhaOnly = true): EarQuestion {
  const sa = 60 + mod12(tonicPc);
  const degrees = shuddhaOnly ? [0, 2, 4, 5, 7, 9, 11] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const d = pick(rng, degrees.slice(1));
  const swara = SWARAS[d];
  const options = degrees.map((x) => SWARAS[x].full);
  return q({ mode: "swara", promptMsg: { key: "ear.sw.prompt", vars: { note: pcName(tonicPc) } }, play: [{ kind: "sequence", notes: [sa, sa + d] }], options, answer: swara.full, explanationMsg: { key: "ear.sw.exp", vars: { swara: swara.full, note: pcName(sa + d), n: d } } });
}

export function makeQuestion(mode: EarMode, rng: Rng, tonicPc = 0, level = 1): EarQuestion {
  switch (mode) {
    case "high-low": return highLowQuestion(rng);
    case "match-note": return matchNoteQuestion(rng);
    case "major-minor": return majorMinorQuestion(rng);
    case "interval": return intervalQuestion(rng, level > 1 ? 12 : 7);
    case "melody": return melodyQuestion(rng, Math.min(5, 2 + level));
    case "scale-note": return scaleNoteQuestion(rng);
    case "swara": return swaraQuestion(rng, tonicPc, level < 3);
  }
}

/** Deterministic RNG for tests. */
export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
