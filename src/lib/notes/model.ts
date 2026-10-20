import { z } from "zod";
import { parseNote, pcName, type Spelling } from "@/lib/music/notes";
import { STANDARD_TUNING } from "@/lib/music/guitar";

/**
 * The student's own written notes: guitar tabs, guitar chord sheets (chords over lyrics) and
 * piano note sheets (lyric line + the notes to play under it).
 */
export const NOTE_KINDS = ["tab", "chords", "piano"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const noteInstrument = (k: NoteKind): "guitar" | "piano" => (k === "piano" ? "piano" : "guitar");

/** Tab strings, top line first (high e) → bottom line (low E), as tabs are written. */
export const TAB_STRINGS = 6;
export const DEFAULT_TUNING = "E A D G B E";

const CellSchema = z.string().max(6);
/** One tab column = one cell per string, top line first. A column of "|" is a bar line. */
const ColSchema = z.array(CellSchema).length(TAB_STRINGS);

export const TabSectionSchema = z.object({
  id: z.string(),
  name: z.string().max(40).catch(""),
  cols: z.array(ColSchema).min(1).max(400),
});
export type TabSection = z.infer<typeof TabSectionSchema>;

export const PianoLineSchema = z.object({
  id: z.string(),
  lyric: z.string().max(160).catch(""),
  notes: z.string().max(300).catch(""),
});
export type PianoLine = z.infer<typeof PianoLineSchema>;

export const NoteSchema = z.object({
  id: z.string(),
  kind: z.enum(NOTE_KINDS),
  title: z.string().min(1).max(80),
  artist: z.string().max(80).catch(""),
  /** Guitar: tuning low → high, e.g. "E A D G B E". */
  tuning: z.string().max(40).optional(),
  capo: z.number().int().min(0).max(12).optional(),
  /** kind = "tab" */
  tab: z.array(TabSectionSchema).max(40).optional(),
  /** kind = "chords": chords over lyrics, or inline [C]chords. */
  text: z.string().max(30000).optional(),
  /** kind = "piano" */
  piano: z.array(PianoLineSchema).max(300).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Note = z.infer<typeof NoteSchema>;

/* ---------------- Tabs ---------------- */

export const emptyCol = (): string[] => Array(TAB_STRINGS).fill("");
export const barCol = (): string[] => Array(TAB_STRINGS).fill("|");
export const isBarCol = (c: string[]) => c.every((x) => x === "|");

/** Line labels top → bottom from a low → high tuning string ("E A D G B E" → E B G D A E). */
export function tuningLabels(tuning = DEFAULT_TUNING): string[] {
  const parts = tuning.trim().split(/\s+/).filter(Boolean);
  const six = parts.length === TAB_STRINGS ? parts : DEFAULT_TUNING.split(" ");
  return [...six].reverse();
}

/** Open-string MIDI notes low → high; each name goes to the octave nearest standard tuning. */
export function tuningMidi(tuning = DEFAULT_TUNING): number[] {
  const labels = [...tuningLabels(tuning)].reverse();
  return STANDARD_TUNING.map((std, i) => {
    const p = parseNote(labels[i]);
    if (!p) return std;
    const d = (((p.pc - std) % 12) + 12) % 12;
    return std + (d > 6 ? d - 12 : d);
  });
}

/** Fret number a cell starts with ("11", "7h9" → 7); null for empty / muted / technique-only cells. */
export function cellFret(cell: string): number | null {
  const m = /^\d{1,2}/.exec(cell);
  return m ? Number(m[0]) : null;
}

const TAB_CONTENT = /^[-0-9hpbrsvx~/\\|*().<>=^ ]+$/i;
const TAB_LINE = /^\s*([A-Ga-g][#b]?)?\s*[|:]?(.*)$/;

function isTabLine(line: string): boolean {
  const m = TAB_LINE.exec(line);
  if (!m) return false;
  const body = m[2].trimEnd();
  return (body.match(/-/g)?.length ?? 0) >= 3 && TAB_CONTENT.test(body);
}

/**
 * Reads plain-text (ASCII) tab like
 *   e|--11-9-------|
 *   B|--------11---|
 * Every run of 6 tab lines becomes a section; a text line just above ("[Intro]", "Verse:") names it.
 */
export function parseAsciiTab(raw: string): { sections: { name: string; cols: string[][] }[]; tuning?: string } {
  const lines = raw.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  const sections: { name: string; cols: string[][] }[] = [];
  let tuning: string | undefined;
  let lastText = "";
  for (let i = 0; i < lines.length; ) {
    if (!isTabLine(lines[i])) {
      const t = lines[i].trim();
      if (t) lastText = t;
      i++;
      continue;
    }
    let j = i;
    while (j < lines.length && isTabLine(lines[j])) j++;
    for (let g = i; g + TAB_STRINGS <= j; g += TAB_STRINGS) {
      const group = lines.slice(g, g + TAB_STRINGS).map((l) => TAB_LINE.exec(l)!);
      const labels = group.map((m) => m[1]);
      if (!tuning && labels.every(Boolean)) tuning = [...labels].reverse().map((l) => l![0].toUpperCase() + l!.slice(1)).join(" ");
      const cols = asciiColumns(group.map((m) => m[2].trimEnd()));
      if (cols.length) sections.push({ name: lastText.replace(/^[[{(]+|[\]})]+$|:$/g, "").trim().slice(0, 40), cols });
      lastText = "";
    }
    i = j;
  }
  return { sections, tuning };
}

function asciiColumns(rows: string[]): string[][] {
  const width = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => r.padEnd(width, "-"));
  const blank = (ch: string) => ch === "-" || ch === " ";
  const cols: string[][] = [];
  for (let x = 0; x < width; ) {
    const chars = grid.map((r) => r[x]);
    if (chars.every(blank)) {
      x++;
      continue;
    }
    if (chars.every((c) => c === "|")) {
      cols.push(barCol());
      x++;
      continue;
    }
    // A token spans while any string still has a non-dash, non-bar character.
    let end = x;
    while (end < width && grid.some((r) => !blank(r[end]) && r[end] !== "|")) end++;
    if (end === x) {
      x++;
      continue;
    }
    cols.push(grid.map((r) => r.slice(x, end).replace(/[-|\s]/g, "").slice(0, 6)));
    x = end;
  }
  while (cols.length && isBarCol(cols[0])) cols.shift();
  while (cols.length && isBarCol(cols[cols.length - 1])) cols.pop();
  return cols.slice(0, 400);
}

/** Plain-text tab for copying / sharing. */
export function tabToAscii(sections: Pick<TabSection, "name" | "cols">[], tuning = DEFAULT_TUNING): string {
  const labels = tuningLabels(tuning);
  const pad = Math.max(...labels.map((l) => l.length));
  return sections
    .map((s) => {
      const rows = labels.map((l) => l.padEnd(pad) + "|-");
      for (const c of s.cols) {
        if (isBarCol(c)) {
          rows.forEach((_, r) => (rows[r] += "|-"));
          continue;
        }
        const w = Math.max(1, ...c.map((x) => x.length));
        c.forEach((cell, r) => (rows[r] += (cell || "").padEnd(w, "-") + "-"));
      }
      return [s.name ? `[${s.name}]` : "", ...rows.map((r) => r + "|")].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

/* ---------------- Piano notes ---------------- */

const NOTE_TOKEN = /^([A-Ga-g])([#b♯♭]?)(\d)?$/;

/** Notes in a line like "A A# C  A# A G" (sharps/flats, optional octave numbers). Other tokens are ignored. */
export function pianoTokens(notes: string): { name: string; pc: number; octave?: number }[] {
  return notes
    .split(/[\s,|]+/)
    .map((tok) => NOTE_TOKEN.exec(tok))
    .flatMap((m) => {
      if (!m) return [];
      const name = m[1].toUpperCase() + m[2].replace("♯", "#").replace("♭", "b");
      const p = parseNote(name);
      return p ? [{ name, pc: p.pc, octave: m[3] ? Number(m[3]) : undefined }] : [];
    });
}

/** Every different note used, from C upwards, spelled the way the student first wrote it. */
export function notesUsed(lines: Pick<PianoLine, "notes">[], spelling: Spelling = "sharp"): string[] {
  const byPc = new Map<number, string>();
  for (const l of lines) for (const t of pianoTokens(l.notes)) if (!byPc.has(t.pc)) byPc.set(t.pc, t.name);
  return [...byPc.keys()].sort((a, b) => a - b).map((pc) => byPc.get(pc) ?? pcName(pc, spelling));
}

/**
 * MIDI numbers for playback. Written octaves are kept; otherwise each note goes to the octave
 * closest to the previous one (starting around middle C), which follows how melodies move.
 */
export function melodyMidi(tokens: { pc: number; octave?: number }[], start = 60): number[] {
  let prev = start + 5;
  return tokens.map((t) => {
    let m: number;
    if (t.octave !== undefined) m = (t.octave + 1) * 12 + t.pc;
    else {
      m = Math.floor(prev / 12) * 12 + t.pc;
      if (m - prev > 6) m -= 12;
      else if (prev - m > 6) m += 12;
    }
    prev = m;
    return m;
  });
}

/** A lyric like "[Chorus]" with no notes is shown as a heading. */
export function pianoHeading(l: Pick<PianoLine, "lyric" | "notes">): string | null {
  const m = /^\s*\[(.+)\]\s*$/.exec(l.lyric);
  return m && !l.notes.trim() ? m[1] : null;
}

export function pianoToText(lines: PianoLine[]): string {
  return lines.map((l) => [l.lyric, l.notes].filter((x) => x.trim()).join("\n")).join("\n\n");
}

/* ---------------- Previews ---------------- */

export function notePreview(n: Note): string {
  if (n.kind === "tab") return (n.tab ?? []).map((s) => s.name).filter(Boolean).join(" · ");
  if (n.kind === "piano") return (n.piano ?? []).find((l) => l.lyric.trim() && !pianoHeading(l))?.lyric ?? "";
  return (n.text ?? "").split("\n").find((l) => l.trim() && !/^\s*[[{]/.test(l) && /[a-z]{3}/i.test(l) && !/^[\sA-G#bm/0-9susdimaj-]+$/.test(l))?.trim() ?? "";
}
