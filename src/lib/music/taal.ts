/**
 * Hindustani taal (rhythm cycle) definitions, used by the rhythm trainer, TaalVisual and lessons.
 *
 * Structure (matras, vibhag division, clap pattern, theka bols) follows the standard Bhatkhande
 * notation used in Hindustani music teaching — see e.g. Wikipedia "Tala (music)" (Hindustani section)
 * and standard tabla primers:
 *   Dadra    6 matras, 3+3,      X 0,       Dha Dhi Na | Dha Ti Na
 *   Keherwa  8 matras, 4+4,      X 0,       Dha Ge Na Ti | Na Ka Dhi Na
 *   Rupak    7 matras, 3+2+2,    0 1 2,     Ti Ti Na | Dhi Na | Dhi Na   (sam falls on the khali)
 *   Teentaal 16 matras, 4+4+4+4, X 2 0 3,   Dha Dhin Dhin Dha | Dha Dhin Dhin Dha | Dha Tin Tin Ta | Ta Dhin Dhin Dha
 *
 * Notation: X = sam (first beat, clap), 0 = khali (wave of the hand, "empty"), 2/3 = further claps (tali).
 * Bol spellings vary slightly between gharanas and books (e.g. Dadra "Dha Ti Na" / "Dha Tu Na").
 */

export type TaalId = "dadra" | "keherwa" | "rupak" | "teentaal";
export type VibhagMark = "X" | "0" | "1" | "2" | "3";

export interface Taal {
  id: TaalId;
  name: string;
  /** Devanagari name */
  hindi: string;
  matras: number;
  /** Length of each vibhag (section); sums to `matras`. */
  vibhag: number[];
  /** Clap marker at the start of each vibhag. */
  marks: VibhagMark[];
  /** Theka (basic tabla bols), one per matra. */
  bols: string[];
  /** Feel in Western terms. */
  western: string;
  /** Typical feel / where it's used. */
  feel: string;
}

export const TAALS: Record<TaalId, Taal> = {
  dadra: {
    id: "dadra",
    name: "Dadra",
    hindi: "दादरा",
    matras: 6,
    vibhag: [3, 3],
    marks: ["X", "0"],
    bols: ["Dha", "Dhi", "Na", "Dha", "Ti", "Na"],
    western: "Like 6/8 — two groups of three",
    feel: "A lilting, swaying feel common in light-classical, ghazal-style and romantic film songs.",
  },
  keherwa: {
    id: "keherwa",
    name: "Keherwa",
    hindi: "कहरवा",
    matras: 8,
    vibhag: [4, 4],
    marks: ["X", "0"],
    bols: ["Dha", "Ge", "Na", "Ti", "Na", "Ka", "Dhi", "Na"],
    western: "Like 4/4 counted in eighth notes",
    feel: "The most common rhythm in film, folk and pop songs — a steady, danceable groove.",
  },
  rupak: {
    id: "rupak",
    name: "Rupak",
    hindi: "रूपक",
    matras: 7,
    vibhag: [3, 2, 2],
    marks: ["0", "1", "2"],
    bols: ["Ti", "Ti", "Na", "Dhi", "Na", "Dhi", "Na"],
    western: "Like 7/8 grouped 3+2+2",
    feel: "Unusual because the cycle starts on khali (the sam is 'empty'). Heard in semi-classical songs and bhajans.",
  },
  teentaal: {
    id: "teentaal",
    name: "Teentaal",
    hindi: "तीनताल",
    matras: 16,
    vibhag: [4, 4, 4, 4],
    marks: ["X", "2", "0", "3"],
    bols: ["Dha", "Dhin", "Dhin", "Dha", "Dha", "Dhin", "Dhin", "Dha", "Dha", "Tin", "Tin", "Ta", "Ta", "Dhin", "Dhin", "Dha"],
    western: "16 beats in four groups of four",
    feel: "The most important taal in Hindustani classical music.",
  },
};

export const TAAL_LIST: Taal[] = [TAALS.dadra, TAALS.keherwa, TAALS.rupak, TAALS.teentaal];

/** Matra index (0-based) where each vibhag starts. */
export function vibhagStarts(t: Taal): number[] {
  const out: number[] = [];
  let i = 0;
  for (const len of t.vibhag) {
    out.push(i);
    i += len;
  }
  return out;
}

/** Marker for a matra (X / 0 / 2 / 3) if it starts a vibhag, else null. */
export function markAt(t: Taal, matra: number): VibhagMark | null {
  const idx = vibhagStarts(t).indexOf(matra % t.matras);
  return idx === -1 ? null : t.marks[idx];
}

/** The sam is always the first matra (index 0), even in Rupak where it is also khali. */
export const SAM_INDEX = 0;

/** Matra indices that are khali (shown as 0). */
export function khaliMatras(t: Taal): number[] {
  const starts = vibhagStarts(t);
  return t.marks.flatMap((m, i) => (m === "0" ? [starts[i]] : []));
}

/** Matra indices that are claps (X or numbered tali). */
export function taliMatras(t: Taal): number[] {
  const starts = vibhagStarts(t);
  return t.marks.flatMap((m, i) => (m !== "0" ? [starts[i]] : []));
}

/* ---------------- Tabla-like sound per bol ---------------- */

/**
 * Approximate sound recipe for a bol: `high` = the small (dayan) drum ring, `low` = the bass (bayan).
 * Bols with "Dh"/"Gh"/"Ge" use the bass; "Na/Ta/Tin/Ti/Ka" are treble only. A simplified model for
 * practice clicks — not a tabla sample.
 */
export function bolVoice(bol: string): { high: boolean; low: boolean; muted: boolean } {
  const b = bol.toLowerCase();
  const low = b.startsWith("dh") || b.startsWith("ge") || b.startsWith("gh");
  const high = !b.startsWith("ge") && !b.startsWith("gh") && b !== "ka";
  return { high, low, muted: b === "ka" || b === "ti" || b === "tu" };
}

/* ---------------- Instrument patterns ---------------- */

export interface StrumPattern {
  /** One symbol per matra: D (down), U (up), - (miss / let ring). */
  pattern: string[];
  /** Matra offsets (0-based) that are played. */
  hits: number[];
  description: string;
}

/** Commonly taught guitar strums for Hindi songs (one stroke per matra). */
export const GUITAR_STRUMS: Partial<Record<TaalId, StrumPattern[]>> = {
  dadra: [
    { pattern: ["D", "-", "D", "U", "D", "U"], hits: [0, 2, 3, 4, 5], description: "Classic 6/8 Dadra strum: a strong down on sam, then down-up down-up. Count 1 2 3 4 5 6." },
    { pattern: ["D", "-", "-", "D", "U", "-"], hits: [0, 3, 4], description: "Gentle ballad variant: big strum on 1, soft down-up on 4 and 5." },
  ],
  keherwa: [
    { pattern: ["D", "-", "D", "U", "-", "U", "D", "U"], hits: [0, 2, 3, 5, 6, 7], description: "The everyday Keherwa / pop strum: D - D U - U D U. Count 1 2 3 4 5 6 7 8." },
    { pattern: ["-", "U", "-", "U", "-", "U", "-", "U"], hits: [1, 3, 5, 7], description: "Off-beat 'chop': only the upstrokes between the main beats — a skipping, folk-dance feel." },
  ],
};

export type LeftHandStep = "root" | "fifth" | "octave" | "chord" | null;

/** Simple piano left-hand accompaniment per taal (one entry per matra). */
export const PIANO_LEFT_HAND: Partial<Record<TaalId, { steps: LeftHandStep[]; description: string }>> = {
  dadra: { steps: ["root", "chord", "chord", "fifth", "chord", "chord"], description: "Root on 1, chord on 2–3, fifth on 4, chord on 5–6 — a gentle 'oom-pah-pah, oom-pah-pah'." },
  keherwa: { steps: ["root", null, "fifth", "octave", "root", null, "fifth", "octave"], description: "Root, (rest), fifth, octave — twice per cycle. A rolling Bollywood-pop left hand." },
  rupak: { steps: ["root", "fifth", "octave", "root", "fifth", "root", "fifth"], description: "Follow the 3+2+2 grouping: root on 1, 4 and 6." },
};

/** Semitone offset above the root for a left-hand step (null = rest; chord = played by the right hand). */
export function leftHandOffset(step: LeftHandStep): number | null {
  if (step === "root") return 0;
  if (step === "fifth") return 7;
  if (step === "octave") return 12;
  return null;
}
