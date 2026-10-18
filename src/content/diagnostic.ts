import type { AudioExample, Visual } from "./types";
import type { Track } from "@/lib/storage/schemas";

/**
 * Placement (diagnostic) quiz. Questions are grouped into tiers per track; each tier corresponds to a
 * curriculum level. Passing a tier places the student one level ABOVE it, which unlocks that tier's
 * lessons (see isUnlocked: placement[track] > lesson.level). Tiers are taken in order and placement
 * stops at the first tier the student doesn't pass. "I'm not sure" always counts as not known.
 */
export const NOT_SURE = "I'm not sure";

export interface DiagnosticQuestion {
  id: string;
  track: Track;
  /** Curriculum level this question checks. */
  tier: number;
  question: string;
  options: string[];
  answer: number;
  audio?: AudioExample;
  visual?: Visual;
  /** Shown after the quiz. */
  explanation: string;
}

export const TIERS: Record<Track, number[]> = {
  theory: [0, 1, 5],
  guitar: [2, 3],
  piano: [4],
};

/** Fraction of a tier that must be correct to count as known. */
export const PASS_FRACTION = 2 / 3;

const Q = (q: Omit<DiagnosticQuestion, "options"> & { options: string[] }): DiagnosticQuestion => ({ ...q, options: [...q.options, NOT_SURE] });

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  // Theory — Level 0 (sound, pitch, beat)
  Q({ id: "t0-higher", track: "theory", tier: 0, question: "Listen to two notes. Which one sounds higher (brighter, thinner)?", options: ["The first", "The second", "They're the same"], answer: 1, audio: { type: "notes", notes: ["C4", "A4"], step: 0.8 }, explanation: "The second note (A) is higher than the first (C)." }),
  Q({ id: "t0-tempo", track: "theory", tier: 0, question: "In music, what does 'tempo' mean?", options: ["How fast or slow the music goes", "How loud it is", "How high the notes are"], answer: 0, explanation: "Tempo is the speed of the beat." }),
  Q({ id: "t0-beat", track: "theory", tier: 0, question: "The steady pulse you can clap or tap your foot to is called the…", options: ["Beat", "Chord", "Scale"], answer: 0, audio: { type: "rhythm", pattern: [0, 1, 2, 3], bpm: 90, beatsPerBar: 4 }, explanation: "That steady pulse is the beat." }),
  // Theory — Level 1 (foundations)
  Q({ id: "t1-alphabet", track: "theory", tier: 1, question: "How many different letter names are used for musical notes?", options: ["5", "7", "12"], answer: 1, explanation: "A B C D E F G — seven letters, then they repeat." }),
  Q({ id: "t1-sharp", track: "theory", tier: 1, question: "What does a sharp sign (♯) do to a note?", options: ["Raises it by one semitone", "Lowers it by one semitone", "Makes it louder"], answer: 0, explanation: "A sharp raises a note by one semitone (one key or fret)." }),
  Q({ id: "t1-staff", track: "theory", tier: 1, question: "What is the name of this note in treble clef?", options: ["E", "F", "G"], answer: 0, visual: { type: "staff", clef: "treble", notes: [{ note: "E4", duration: "w" }] }, explanation: "The bottom line of the treble staff is E." }),
  Q({ id: "t1-half", track: "theory", tier: 1, question: "In 4/4 time, how many beats does a half note last?", options: ["1", "2", "4"], answer: 1, explanation: "A half note lasts two beats." }),
  // Theory — Level 5 (scales & harmony)
  Q({ id: "t5-cmaj", track: "theory", tier: 5, question: "Which notes make a C major chord?", options: ["C E G", "C E♭ G", "C F A"], answer: 0, explanation: "C major = C, E, G (root, major 3rd, perfect 5th)." }),
  Q({ id: "t5-relative", track: "theory", tier: 5, question: "What is the relative minor of C major?", options: ["A minor", "C minor", "E minor"], answer: 0, explanation: "A minor shares all its notes with C major." }),
  Q({ id: "t5-gsharp", track: "theory", tier: 5, question: "Which note is sharp in the G major scale?", options: ["C♯", "F♯", "G♯"], answer: 1, explanation: "G major has one sharp: F♯." }),
  // Guitar — Level 2 (fundamentals)
  Q({ id: "g2-tuning", track: "guitar", tier: 2, question: "What is standard guitar tuning, from the thickest string to the thinnest?", options: ["E A D G B E", "E B G D A E", "A D G C E A"], answer: 0, explanation: "Low to high: E A D G B E." }),
  Q({ id: "g2-string1", track: "guitar", tier: 2, question: "Which string do guitarists call 'string 1'?", options: ["The thickest (low E)", "The thinnest (high E)", "The middle (G)"], answer: 1, explanation: "Strings are numbered from the thinnest: string 1 is the high E." }),
  Q({ id: "g2-tab", track: "guitar", tier: 2, question: "In guitar tab, a '3' on a line means…", options: ["Play that string at the 3rd fret", "Play 3 times", "Use your 3rd finger only"], answer: 0, explanation: "Tab numbers are fret numbers on that string." }),
  // Guitar — Level 3 (chords & rhythm)
  Q({ id: "g3-diagram", track: "guitar", tier: 3, question: "Which open chord is shown in this diagram?", options: ["G major", "C major", "D major"], answer: 1, visual: { type: "chord-diagram", chords: ["C"], caption: "Mystery chord" }, explanation: "x32010 is the open C major chord." }),
  Q({ id: "g3-power", track: "guitar", tier: 3, question: "A power chord (like E5) is made of…", options: ["Root and 5th", "Root, 3rd and 5th", "Only open strings"], answer: 0, explanation: "Power chords have no 3rd: just the root and the 5th." }),
  Q({ id: "g3-strum", track: "guitar", tier: 3, question: "In a basic 4/4 strumming pattern, down-strums usually fall on…", options: ["The beat numbers (1, 2, 3, 4)", "The '&'s between beats", "Only the last beat"], answer: 0, explanation: "Down on the numbers, up on the '&'s." }),
  // Piano — Level 4 (fundamentals)
  Q({ id: "p4-middle-c", track: "piano", tier: 4, question: "Which note is just to the left of every group of two black keys?", options: ["C", "F", "A"], answer: 0, visual: { type: "keyboard", low: 48, high: 71, highlight: [60], showLabels: false, caption: "The highlighted key" }, explanation: "C sits left of each group of two black keys. The highlighted one is middle C." }),
  Q({ id: "p4-thumb", track: "piano", tier: 4, question: "In piano finger numbers, which finger is number 1?", options: ["Thumb", "Index finger", "Little finger"], answer: 0, explanation: "On both hands, the thumb is finger 1." }),
  Q({ id: "p4-bass", track: "piano", tier: 4, question: "Piano music has two staffs. Which one does the left hand usually read?", options: ["The bass clef (lower) staff", "The treble clef (upper) staff"], answer: 0, explanation: "The left hand usually reads the bass clef." }),
];

export type Answers = Record<string, number | undefined>;

export interface TrackResult {
  track: Track;
  placement: number;
  tiers: { tier: number; correct: number; total: number; passed: boolean }[];
}

export function questionsFor(tracks: Track[]): DiagnosticQuestion[] {
  return DIAGNOSTIC_QUESTIONS.filter((q) => tracks.includes(q.track));
}

export function isCorrect(q: DiagnosticQuestion, answer: number | undefined): boolean {
  return answer !== undefined && answer === q.answer && q.options[answer] !== NOT_SURE;
}

/** Pure placement scoring. */
export function scoreTrack(track: Track, answers: Answers, questions: DiagnosticQuestion[] = DIAGNOSTIC_QUESTIONS): TrackResult {
  const tiers: TrackResult["tiers"] = [];
  let placement = 0;
  let stopped = false;
  for (const tier of TIERS[track]) {
    const qs = questions.filter((q) => q.track === track && q.tier === tier);
    const correct = qs.filter((q) => isCorrect(q, answers[q.id])).length;
    const passed = qs.length > 0 && correct / qs.length >= PASS_FRACTION - 1e-9;
    tiers.push({ tier, correct, total: qs.length, passed: passed && !stopped });
    if (!stopped && passed) placement = tier + 1;
    else stopped = true;
  }
  return { track, placement, tiers };
}

export function scorePlacement(tracks: Track[], answers: Answers): Partial<Record<Track, TrackResult>> {
  const out: Partial<Record<Track, TrackResult>> = {};
  for (const t of tracks) out[t] = scoreTrack(t, answers);
  return out;
}
