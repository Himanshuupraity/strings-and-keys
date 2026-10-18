import { GUITAR_STRUMS, TAALS, type TaalId } from "@/lib/music/taal";

/**
 * Rhythm trainer patterns. `hits` are beat offsets (in beats, quarter = 1) within ONE bar;
 * the pattern repeats for `bars` bars.
 */
export interface RhythmPattern {
  id: string;
  name: string;
  level: number;
  beatsPerBar: number;
  bpm: number;
  bars: number;
  hits: number[];
  description: string;
  /** Text counting guide, e.g. "1 2 3 4" */
  count: string;
  /** Indian taal patterns: one beat = one matra; bols and sam/khali come from the taal. */
  taal?: TaalId;
  group?: "western" | "taal";
}

export const RHYTHM_PATTERNS: RhythmPattern[] = [
  { id: "quarters", name: "Steady quarter notes", level: 1, beatsPerBar: 4, bpm: 70, bars: 2, hits: [0, 1, 2, 3], description: "Tap on every beat. Count 1 2 3 4.", count: "1 2 3 4" },
  { id: "halves", name: "Half notes", level: 1, beatsPerBar: 4, bpm: 70, bars: 2, hits: [0, 2], description: "Tap on beats 1 and 3 only — let each note last two beats.", count: "1 (2) 3 (4)" },
  { id: "quarter-rest", name: "Quarters with a rest", level: 2, beatsPerBar: 4, bpm: 75, bars: 2, hits: [0, 1, 2], description: "Tap 1 2 3, stay silent on 4. Rests are part of the rhythm!", count: "1 2 3 (rest)" },
  { id: "waltz", name: "Waltz in 3/4", level: 2, beatsPerBar: 3, bpm: 90, bars: 3, hits: [0, 1, 2], description: "Three beats per bar: ONE two three.", count: "1 2 3" },
  { id: "eighths", name: "Eighth notes", level: 3, beatsPerBar: 4, bpm: 65, bars: 2, hits: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], description: "Two taps per beat: 1 and 2 and 3 and 4 and.", count: "1 & 2 & 3 & 4 &" },
  { id: "mixed", name: "Quarters and eighths", level: 3, beatsPerBar: 4, bpm: 70, bars: 2, hits: [0, 1, 1.5, 2, 3, 3.5], description: "1, 2-and, 3, 4-and.", count: "1 2 & 3 4 &" },
  { id: "strum-pop", name: "Pop strum rhythm", level: 4, beatsPerBar: 4, bpm: 70, bars: 2, hits: [0, 1, 1.5, 2.5, 3, 3.5], description: "The classic D-DU-UDU strum: 1, 2&, &, 4&... a beginner favourite.", count: "1 2 & (3) & 4 &" },
  { id: "offbeats", name: "Offbeats only", level: 5, beatsPerBar: 4, bpm: 70, bars: 2, hits: [0.5, 1.5, 2.5, 3.5], description: "Tap only on the 'and's — reggae / ska feel.", count: "(1) & (2) & (3) & (4) &" },
  { id: "syncopation", name: "Syncopation", level: 5, beatsPerBar: 4, bpm: 80, bars: 2, hits: [0, 1.5, 3], description: "3-3-2 feel used in countless pop and Bollywood songs.", count: "1 (2) & (3) 4" },
];

const allMatras = (n: number) => Array.from({ length: n }, (_, i) => i);
const bolCount = (id: TaalId) => TAALS[id].bols.join(" ");
const strumCount = (pattern: string[]) => pattern.map((x) => (x === "-" ? "·" : x)).join(" ");

/** Indian taal patterns. Each beat is one matra; tempo is matras per minute. */
export const TAAL_PATTERNS: RhythmPattern[] = [
  { id: "taal-dadra", name: "Dadra — theka", level: 6, beatsPerBar: 6, bpm: 120, bars: 2, hits: allMatras(6), taal: "dadra", group: "taal", description: "Tap every matra of Dadra (6 beats, 3+3). Lean on sam (X), lighter on khali (0).", count: bolCount("dadra") },
  { id: "taal-dadra-strum", name: "Dadra — guitar strum", level: 6, beatsPerBar: 6, bpm: 120, bars: 2, hits: GUITAR_STRUMS.dadra![0].hits, taal: "dadra", group: "taal", description: GUITAR_STRUMS.dadra![0].description, count: strumCount(GUITAR_STRUMS.dadra![0].pattern) },
  { id: "taal-keherwa", name: "Keherwa — theka", level: 6, beatsPerBar: 8, bpm: 140, bars: 2, hits: allMatras(8), taal: "keherwa", group: "taal", description: "Tap every matra of Keherwa (8 beats, 4+4).", count: bolCount("keherwa") },
  { id: "taal-keherwa-strum", name: "Keherwa — guitar strum", level: 6, beatsPerBar: 8, bpm: 140, bars: 2, hits: GUITAR_STRUMS.keherwa![0].hits, taal: "keherwa", group: "taal", description: GUITAR_STRUMS.keherwa![0].description, count: strumCount(GUITAR_STRUMS.keherwa![0].pattern) },
  { id: "taal-keherwa-offbeat", name: "Keherwa — off-beats", level: 7, beatsPerBar: 8, bpm: 140, bars: 2, hits: GUITAR_STRUMS.keherwa![1].hits, taal: "keherwa", group: "taal", description: GUITAR_STRUMS.keherwa![1].description, count: strumCount(GUITAR_STRUMS.keherwa![1].pattern) },
  { id: "taal-rupak", name: "Rupak — theka", level: 7, beatsPerBar: 7, bpm: 120, bars: 2, hits: allMatras(7), taal: "rupak", group: "taal", description: "Seven matras, 3+2+2 — the cycle starts on khali (0).", count: bolCount("rupak") },
];

export const ALL_RHYTHM_PATTERNS: RhythmPattern[] = [...RHYTHM_PATTERNS, ...TAAL_PATTERNS];

/** Absolute times (seconds) of every expected hit, given when bar 1 starts. */
export function patternHitTimes(p: RhythmPattern, startTime: number, bpm = p.bpm): number[] {
  const beat = 60 / bpm;
  const out: number[] = [];
  for (let bar = 0; bar < p.bars; bar++) for (const h of p.hits) out.push(startTime + (bar * p.beatsPerBar + h) * beat);
  return out;
}

/** Total duration (seconds) of the pattern after the count-in. */
export function patternDuration(p: RhythmPattern, bpm = p.bpm): number {
  return (p.bars * p.beatsPerBar * 60) / bpm;
}

/** Feedback text from a timing score. */
export function rhythmFeedback(r: { hitCount: number; missed: number; extra: number; early: number; late: number; meanAbsMs: number | null }, total: number): string {
  if (r.hitCount === 0) return "No taps matched the beat. Listen to the count-in, then tap with the clicks.";
  const parts: string[] = [];
  if (r.hitCount === total && r.extra === 0) parts.push("You hit every note!");
  else parts.push(`${r.hitCount} of ${total} notes hit.`);
  if (r.missed) parts.push(`${r.missed} missed.`);
  if (r.extra) parts.push(`${r.extra} extra tap${r.extra > 1 ? "s" : ""} — watch the rests.`);
  if (r.early > r.late && r.early >= 2) parts.push("You tend to rush (tap early). Relax and wait for the beat.");
  else if (r.late > r.early && r.late >= 2) parts.push("You tend to drag (tap late). Anticipate the beat slightly.");
  if (r.meanAbsMs !== null) parts.push(`Average timing error: ${Math.round(r.meanAbsMs)} ms.`);
  return parts.join(" ");
}
