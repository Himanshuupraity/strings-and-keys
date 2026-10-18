import { shapeMidi, easiestShape } from "@/lib/music/chords";
import { midiToName } from "@/lib/music/notes";
import { mistakeSummaryMessage, sequenceAccuracy, startSequence, stepSequence, type SequenceState } from "@/lib/exercises/sequence";
import { analyzeChord, analyzeNote, uncertainFeedback, type Feedback } from "./analysis";
import { enText, type I18nMessage } from "@/lib/i18n/messages";

/**
 * The listening-teacher loop as a pure state machine:
 *   explain → demo → try (listening) → feedback → (retry → try) | (next → explain)
 * Adapts with an easier/harder ladder per instrument.
 */

export type InputSource = "virtual" | "midi" | "mic";

export interface CoachExercise {
  id: string;
  instrument: "guitar" | "piano";
  title: string;
  explain: string;
  hint: string;
  kind: "note" | "sequence" | "chord";
  /** MIDI targets in order (single item for "note"). For chords: the notes demonstrated. */
  targets: number[];
  chord?: string;
  skill: string;
  /** Guitar: positions to highlight on the fretboard. */
  positions?: { string: number; fret: number }[];
  fingers?: number[];
}

const emChord = easiestShape("Em")!;
const cChordG = easiestShape("C")!;

export const GUITAR_LADDER: CoachExercise[] = [
  {
    id: "coach-g-high-e",
    instrument: "guitar",
    title: "Open high E string",
    explain: "Let's play the open high E string. It's the thinnest string — the one closest to the floor when you hold the guitar. 'Open' means you don't press any fret: just pick it once and let it ring.",
    hint: "Pick downward through only the thinnest string. Keep your fretting hand off the neck.",
    kind: "note",
    targets: [64],
    skill: "open strings",
    positions: [{ string: 5, fret: 0 }],
  },
  {
    id: "coach-g-low-e",
    instrument: "guitar",
    title: "Open low E string",
    explain: "Now the thickest string — the low E, nearest your face. It's the same note name as the high E, two octaves lower.",
    hint: "The thickest string is at the top when you look down at the guitar.",
    kind: "note",
    targets: [40],
    skill: "open strings",
    positions: [{ string: 0, fret: 0 }],
  },
  {
    id: "coach-g-open-strings",
    instrument: "guitar",
    title: "All six open strings, high to low",
    explain: "Play each open string once, from the thinnest to the thickest: E, B, G, D, A, E. Let each ring before moving on.",
    hint: "Remember 'Eddie Ate Dynamite, Good Bye Eddie' — that's low to high. We're going backwards: E B G D A E.",
    kind: "sequence",
    targets: [64, 59, 55, 50, 45, 40],
    skill: "open strings",
    positions: [5, 4, 3, 2, 1, 0].map((s) => ({ string: s, fret: 0 })),
  },
  {
    id: "coach-g-e-f-g",
    instrument: "guitar",
    title: "E – F – G on the high E string",
    explain: "Your first fretted notes. On the high E string: open (E), then 1st fret with finger 1 (F), then 3rd fret with finger 3 (G).",
    hint: "Press just behind the fret wire, not on top of it — that stops buzzing.",
    kind: "sequence",
    targets: [64, 65, 67],
    skill: "fretting notes",
    positions: [{ string: 5, fret: 0 }, { string: 5, fret: 1 }, { string: 5, fret: 3 }],
    fingers: [0, 1, 3],
  },
  {
    id: "coach-g-g-a-b",
    instrument: "guitar",
    title: "G – A – B on the G string",
    explain: "On the G string (3rd string): open G, 2nd fret A (finger 2), 4th fret B (finger 4).",
    hint: "Keep your thumb behind the neck, roughly opposite your 2nd finger.",
    kind: "sequence",
    targets: [55, 57, 59],
    skill: "fretting notes",
    positions: [{ string: 3, fret: 0 }, { string: 3, fret: 2 }, { string: 3, fret: 4 }],
    fingers: [0, 2, 4],
  },
  {
    id: "coach-g-em",
    instrument: "guitar",
    title: "E minor chord",
    explain: "Your first chord: E minor. Fingers 2 and 3 on the 2nd fret of the A and D strings, then strum all six strings.",
    hint: "Arch your fingers so the open G, B and E strings can ring clearly.",
    kind: "chord",
    chord: "Em",
    targets: shapeMidi(emChord),
    skill: "open chords",
    positions: emChord.frets.map((f, s) => ({ string: s, fret: f })).filter((p) => p.fret >= 0),
  },
  {
    id: "coach-g-c",
    instrument: "guitar",
    title: "C major chord",
    explain: "C major: ring finger on the A string 3rd fret, middle on the D string 2nd fret, index on the B string 1st fret. Strum from the A string down.",
    hint: "Don't strum the thickest string. Let the open G and high E ring.",
    kind: "chord",
    chord: "C",
    targets: shapeMidi(cChordG),
    skill: "open chords",
    positions: cChordG.frets.map((f, s) => ({ string: s, fret: f })).filter((p) => p.fret >= 0),
  },
];

export const PIANO_LADDER: CoachExercise[] = [
  {
    id: "coach-p-middle-c",
    instrument: "piano",
    title: "Find middle C",
    explain: "Find middle C and play it. Look for the pair of two black keys nearest the middle of the keyboard — the white key just to the LEFT of them is C. The one in the centre is middle C (C4).",
    hint: "On most keyboards middle C sits roughly under the brand name.",
    kind: "note",
    targets: [60],
    skill: "finding notes",
  },
  {
    id: "coach-p-cde",
    instrument: "piano",
    title: "C – D – E",
    explain: "Starting on middle C, play C, D, E with your right hand fingers 1, 2, 3 (thumb is 1).",
    hint: "Each white key to the right is the next letter.",
    kind: "sequence",
    targets: [60, 62, 64],
    skill: "right hand",
    fingers: [1, 2, 3],
  },
  {
    id: "coach-p-five",
    instrument: "piano",
    title: "Five-finger C position: C D E F G",
    explain: "Put one finger on each key from C to G and play them in order, thumb to pinky.",
    hint: "Keep your hand curved like holding a ball; play with fingertips.",
    kind: "sequence",
    targets: [60, 62, 64, 65, 67],
    skill: "right hand",
    fingers: [1, 2, 3, 4, 5],
  },
  {
    id: "coach-p-mary",
    instrument: "piano",
    title: "Melody: Mary Had a Little Lamb",
    explain: "A traditional melody using only C, D and E: E D C D E E E.",
    hint: "Fingers: 3 2 1 2 3 3 3.",
    kind: "sequence",
    targets: [64, 62, 60, 62, 64, 64, 64],
    skill: "melodies",
    fingers: [3, 2, 1, 2, 3, 3, 3],
  },
  {
    id: "coach-p-c-triad",
    instrument: "piano",
    title: "C major triad",
    explain: "Play C, E and G together with fingers 1, 3 and 5. That's a C major chord.",
    hint: "Skip one white key between each finger.",
    kind: "chord",
    chord: "C",
    targets: [60, 64, 67],
    skill: "chords",
    fingers: [1, 3, 5],
  },
  {
    id: "coach-p-c-scale",
    instrument: "piano",
    title: "C major scale",
    explain: "All eight notes from middle C up to the next C: C D E F G A B C. Tuck your thumb under after E (fingering 1 2 3 1 2 3 4 5).",
    hint: "The thumb crosses under finger 3 to land on F.",
    kind: "sequence",
    targets: [60, 62, 64, 65, 67, 69, 71, 72],
    skill: "scales",
    fingers: [1, 2, 3, 1, 2, 3, 4, 5],
  },
];

export function ladderFor(instrument: "guitar" | "piano"): CoachExercise[] {
  return instrument === "guitar" ? GUITAR_LADDER : PIANO_LADDER;
}

export type Phase = "explain" | "demo" | "try" | "feedback" | "complete";

export interface AttemptResult {
  exerciseId: string;
  title: string;
  accuracy: number;
  measured: boolean;
  input: InputSource;
  success: boolean;
}

export interface CoachSessionState {
  instrument: "guitar" | "piano";
  index: number;
  phase: Phase;
  seq: SequenceState;
  attempts: number;
  /** Consecutive failed attempts on this exercise — drives "make it easier". */
  failures: number;
  feedback: Feedback | null;
  /** Notes played in the current attempt, with verdicts, for display. */
  played: { midi: number; ok: boolean }[];
  lastInput: InputSource | null;
  results: AttemptResult[];
  suggestion: "easier" | "harder" | null;
  hintShown: boolean;
}

export type CoachEvent =
  | { type: "EXPLAIN" }
  | { type: "DEMO" }
  | { type: "TRY" }
  | { type: "NOTE"; midi: number; source: InputSource; cents?: number }
  | { type: "CHORD"; pcs: number[]; source: InputSource; confidence?: number }
  | { type: "UNCERTAIN"; reason?: "unclear" | "noisy" | "quiet" }
  | { type: "RETRY" }
  | { type: "NEXT" }
  | { type: "EASIER" }
  | { type: "HARDER" }
  | { type: "HINT" }
  | { type: "GOTO"; index: number }
  | { type: "SET_INSTRUMENT"; instrument: "guitar" | "piano" };

export function currentExercise(s: CoachSessionState): CoachExercise {
  return ladderFor(s.instrument)[s.index];
}

function fresh(instrument: "guitar" | "piano", index: number, results: AttemptResult[] = []): CoachSessionState {
  const ladder = ladderFor(instrument);
  const i = Math.max(0, Math.min(index, ladder.length - 1));
  return {
    instrument,
    index: i,
    phase: "explain",
    seq: startSequence(ladder[i].kind === "chord" ? [] : ladder[i].targets),
    attempts: 0,
    failures: 0,
    feedback: null,
    played: [],
    lastInput: null,
    results,
    suggestion: null,
    hintShown: false,
  };
}

export function initialSession(instrument: "guitar" | "piano", index = 0): CoachSessionState {
  return fresh(instrument, index);
}

const SUCCESS = 0.8;

function finishAttempt(s: CoachSessionState, ex: CoachExercise, accuracy: number, feedback: Feedback, success: boolean, source: InputSource): CoachSessionState {
  const failures = success ? 0 : s.failures + 1;
  const result: AttemptResult = { exerciseId: ex.id, title: ex.title, accuracy, measured: true, input: source, success };
  const lastIdx = ladderFor(s.instrument).length - 1;
  let suggestion: CoachSessionState["suggestion"] = null;
  if (success && accuracy === 1 && s.attempts === 0 && s.index < lastIdx) suggestion = "harder";
  if (!success && failures >= 3 && s.index > 0) suggestion = "easier";
  return { ...s, phase: "feedback", feedback, attempts: s.attempts + 1, failures, results: [...s.results, result], suggestion, lastInput: source };
}

export function coachReducer(s: CoachSessionState, e: CoachEvent): CoachSessionState {
  const ladder = ladderFor(s.instrument);
  const ex = ladder[s.index];
  switch (e.type) {
    case "SET_INSTRUMENT":
      return e.instrument === s.instrument ? s : fresh(e.instrument, 0);
    case "EXPLAIN":
      return { ...s, phase: "explain" };
    case "DEMO":
      return { ...s, phase: s.phase === "feedback" ? "feedback" : "demo" };
    case "TRY":
    case "RETRY":
      return { ...s, phase: "try", seq: startSequence(ex.kind === "chord" ? [] : ex.targets), played: [], feedback: e.type === "RETRY" ? null : s.feedback };
    case "HINT":
      return { ...s, hintShown: true };
    case "NOTE": {
      if (s.phase !== "try" || ex.kind === "chord") return s;
      if (ex.kind === "note") {
        const fb = analyzeNote(ex.targets[0], e.midi, { instrument: ex.instrument, cents: e.cents, source: e.source });
        const success = fb.verdict === "correct" || fb.verdict === "close";
        const accuracy = fb.verdict === "correct" ? 1 : fb.verdict === "close" ? 0.8 : 0;
        return finishAttempt({ ...s, played: [{ midi: e.midi, ok: success }] }, ex, accuracy, fb, success, e.source);
      }
      const step = stepSequence(s.seq, e.midi);
      const played = [...s.played, { midi: e.midi, ok: step.verdict === "correct" }];
      if (!step.state.done) {
        // Live, specific feedback on a wrong note without ending the attempt.
        const fb = step.verdict === "wrong" && step.expected !== undefined ? analyzeNote(step.expected, e.midi, { instrument: ex.instrument, cents: e.cents, source: e.source }) : null;
        return { ...s, seq: step.state, played, feedback: fb, lastInput: e.source };
      }
      const accuracy = sequenceAccuracy(step.state);
      const summary = mistakeSummaryMessage(step.state, (m) => midiToName(m));
      const success = accuracy >= SUCCESS;
      const pct = Math.round(accuracy * 100);
      const titleMsg: I18nMessage = success ? (accuracy === 1 ? { key: "seq.perfect" } : { key: "seq.wellDone", vars: { pct } }) : { key: "seq.finished", vars: { pct } };
      const detailMsg: I18nMessage = summary ?? { key: success ? "seq.wholeInOrder" : "seq.fewSecond" };
      const tipMsg: I18nMessage | undefined = success ? undefined : { key: "seq.hearAgain" };
      const fb: Feedback = { verdict: success ? "correct" : "wrong", title: enText(titleMsg), detail: enText(detailMsg), tip: tipMsg && enText(tipMsg), titleMsg, detailMsg, tipMsg };
      return finishAttempt({ ...s, seq: step.state, played }, ex, accuracy, fb, success, e.source);
    }
    case "CHORD": {
      if (s.phase !== "try" || ex.kind !== "chord" || !ex.chord) return s;
      const fb = analyzeChord(ex.chord, e.pcs, { source: e.source, confidence: e.confidence });
      if (fb.verdict === "uncertain") return { ...s, feedback: fb };
      const success = fb.verdict === "correct";
      return finishAttempt(s, ex, fb.coverage, fb, success, e.source);
    }
    case "UNCERTAIN":
      // Never invent a result: stay in "try" and ask for a clearer replay.
      return s.phase === "try" ? { ...s, feedback: uncertainFeedback(e.reason) } : s;
    case "NEXT":
    case "HARDER":
      if (s.index >= ladder.length - 1) return { ...s, phase: "complete", suggestion: null };
      return fresh(s.instrument, s.index + 1, s.results);
    case "EASIER":
      return fresh(s.instrument, Math.max(0, s.index - 1), s.results);
    case "GOTO":
      return fresh(s.instrument, e.index, s.results);
  }
}
