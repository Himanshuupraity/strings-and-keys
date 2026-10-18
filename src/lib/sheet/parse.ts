import { parseChord } from "@/lib/music/chords";
import { transposeChord } from "@/lib/music/transpose";

/**
 * Song-sheet parser for lyrics + chords the student pastes in. Understands:
 *  - "chords over lyrics": a line of chords placed above the words where they change
 *  - ChordPro inline chords: "[Am]words [F]more words"
 *  - section headers: "[Chorus]", "Verse 1:", "{c: Bridge}", "{start_of_chorus}"
 *  - chord-only lines (intro / interlude), and blank lines
 */
export type SheetLine =
  | { kind: "section"; name: string }
  /** `at` = index in the lyric text (clamped); `col` = original column on the chord line (may pass the end of the words). */
  | { kind: "lyric"; text: string; chords: { chord: string; at: number; col?: number }[] }
  | { kind: "chords"; chords: string[]; cols?: number[] }
  | { kind: "blank" };

export interface ParsedSheet {
  title?: string;
  artist?: string;
  lines: SheetLine[];
}

const SECTION_WORDS = /^(intro|verse|chorus|pre[- ]?chorus|post[- ]?chorus|bridge|outro|interlude|instrumental|solo|hook|refrain|antara|mukhda|sthayi|coda|ending|break|tag|riff)\b/i;
/** Tokens allowed on a chord line besides chords: bar lines, repeat marks, dashes. */
const FILLER = /^(\|+|:?\|\|?:?|-+|\/+|\.+|x\d+|\(x\d+\)|\d+x|\(\d+x\)|\*+|%)$/i;
/** "No chord" marker — shown on the sheet, ignored for transposing / chord lists. */
export const NO_CHORD = "N.C.";
const NC_RE = /^\(?n\.?\s?c\.?\)?$/i;
export const isNoChord = (c: string) => c === NO_CHORD;

function cleanChordToken(t: string): string {
  return t.replace(/^[([{]+|[)\]},.;]+$/g, "");
}

export function isChordToken(t: string): boolean {
  const c = cleanChordToken(t);
  return c.length > 0 && c.length <= 12 && parseChord(c) !== null;
}

/** A chord line has at least one chord and nothing but chords and filler tokens. */
export function chordLinePositions(line: string): { chord: string; at: number }[] | null {
  const out: { chord: string; at: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const tok = m[0];
    if (NC_RE.test(tok)) {
      out.push({ chord: NO_CHORD, at: m.index });
      continue;
    }
    if (FILLER.test(tok)) continue;
    if (!isChordToken(tok)) return null;
    const lead = tok.length - tok.replace(/^[([{]+/, "").length;
    out.push({ chord: cleanChordToken(tok), at: m.index + lead });
  }
  return out.length ? out : null;
}

function sectionName(line: string): string | null {
  const t = line.trim();
  let m = /^\{\s*(?:c|comment|ci)\s*:\s*(.+?)\s*\}$/i.exec(t);
  if (m) return m[1];
  if (/^\{\s*(start_of_chorus|soc)\s*(:.*)?\}$/i.test(t)) return "Chorus";
  if (/^\{\s*(start_of_verse|sov)\s*(:.*)?\}$/i.test(t)) return "Verse";
  if (/^\{\s*(start_of_bridge|sob)\s*(:.*)?\}$/i.test(t)) return "Bridge";
  m = /^\[([^\]]{1,40})\]$/.exec(t);
  if (m && !isChordToken(m[1])) return m[1].trim();
  m = /^([A-Za-z][\w '’-]{0,30}?)\s*:?\s*(\(.*\))?$/.exec(t);
  if (m && SECTION_WORDS.test(m[1]) && (t.endsWith(":") || t.split(/\s+/).length <= 3)) return t.replace(/:$/, "").trim();
  return null;
}

function inlineChordPro(line: string): { text: string; chords: { chord: string; at: number }[] } | null {
  if (!/\[[^\]]+\]/.test(line)) return null;
  const chords: { chord: string; at: number }[] = [];
  let text = "";
  let last = 0;
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (!isChordToken(m[1])) return null;
    text += line.slice(last, m.index);
    chords.push({ chord: cleanChordToken(m[1]), at: text.length });
    last = m.index + m[0].length;
  }
  text += line.slice(last);
  return { text, chords };
}

export function parseSheet(raw: string): ParsedSheet {
  const src = raw.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  const lines: SheetLine[] = [];
  let title: string | undefined;
  let artist: string | undefined;

  for (let i = 0; i < src.length; i++) {
    const line = src[i].replace(/\s+$/, "");
    const t = line.trim();
    if (!t) {
      if (lines.length && lines[lines.length - 1].kind !== "blank") lines.push({ kind: "blank" });
      continue;
    }
    const meta = /^\{\s*(title|t|artist|subtitle|st)\s*:\s*(.+?)\s*\}$/i.exec(t);
    if (meta) {
      if (/^t/i.test(meta[1])) title ??= meta[2];
      else artist ??= meta[2];
      continue;
    }
    if (/^\{\s*(end_of_\w+|eo[cvb])\s*\}$/i.test(t) || /^\{.*\}$/.test(t)) {
      const name = sectionName(t);
      if (name) lines.push({ kind: "section", name });
      continue;
    }
    const sec = sectionName(t);
    if (sec) {
      lines.push({ kind: "section", name: sec });
      continue;
    }
    const positions = chordLinePositions(line);
    if (positions) {
      const next = src[i + 1]?.replace(/\s+$/, "") ?? "";
      const nextIsLyric = next.trim() !== "" && !chordLinePositions(next) && !sectionName(next.trim()) && !/^\{.*\}$/.test(next.trim());
      if (nextIsLyric) {
        const text = next;
        lines.push({ kind: "lyric", text, chords: positions.map((p) => ({ chord: p.chord, at: Math.min(p.at, text.length), col: p.at })) });
        i++;
      } else {
        lines.push({ kind: "chords", chords: positions.map((p) => p.chord), cols: positions.map((p) => p.at) });
      }
      continue;
    }
    const cp = inlineChordPro(line);
    if (cp) {
      if (cp.text.trim()) lines.push({ kind: "lyric", text: cp.text, chords: cp.chords });
      else lines.push({ kind: "chords", chords: cp.chords.map((c) => c.chord) });
      continue;
    }
    lines.push({ kind: "lyric", text: line, chords: [] });
  }
  while (lines.length && lines[lines.length - 1].kind === "blank") lines.pop();
  return { title, artist, lines };
}

/** Every chord in order of appearance. */
export function sheetChords(lines: SheetLine[]): string[] {
  return lines.flatMap((l) => (l.kind === "lyric" ? l.chords.map((c) => c.chord) : l.kind === "chords" ? l.chords : [])).filter((c) => !isNoChord(c));
}

export function uniqueChords(lines: SheetLine[]): string[] {
  return Array.from(new Set(sheetChords(lines)));
}

export function transposeSheet(lines: SheetLine[], semitones: number, targetKey?: string): SheetLine[] {
  if (!semitones) return lines;
  const t = (c: string) => (isNoChord(c) ? c : transposeChord(c, semitones, targetKey));
  return lines.map((l) => (l.kind === "lyric" ? { ...l, chords: l.chords.map((c) => ({ ...c, chord: t(c.chord) })) } : l.kind === "chords" ? { ...l, chords: l.chords.map(t) } : l));
}

/** Best-guess key from the chords: the first chord is usually the home chord in pop/film songs. */
export function guessKey(lines: SheetLine[]): string {
  const first = sheetChords(lines)[0];
  const p = first ? parseChord(first) : null;
  if (!p) return "C";
  const minor = p.suffix.startsWith("m") && !p.suffix.startsWith("maj");
  return p.rootName + (minor ? "m" : "");
}

/** Group chords into practice sections (for loops / capo helper), one bar per chord. */
export function sheetSections(lines: SheetLine[], maxSections = 12, maxBars = 64): { name: string; bars: string[] }[] {
  const out: { name: string; bars: string[] }[] = [];
  let cur: { name: string; bars: string[] } = { name: "Song", bars: [] };
  for (const l of lines) {
    if (l.kind === "section") {
      if (cur.bars.length) out.push(cur);
      cur = { name: l.name.slice(0, 40), bars: [] };
    } else {
      for (const c of l.kind === "lyric" ? l.chords.map((x) => x.chord) : l.kind === "chords" ? l.chords : []) if (!isNoChord(c)) cur.bars.push(c);
    }
  }
  if (cur.bars.length) out.push(cur);
  return out.slice(0, maxSections).map((s) => ({ ...s, bars: s.bars.slice(0, maxBars) }));
}

/** Lines that the follower can land on (lyrics and instrumental chord lines). */
export function isStop(l: SheetLine): boolean {
  return l.kind === "lyric" || l.kind === "chords";
}

/** Splits a lyric line into segments that start at each chord change (for rendering). */
export function lyricSegments(l: Extract<SheetLine, { kind: "lyric" }>): { chord?: string; text: string }[] {
  const chords = [...l.chords].sort((a, b) => a.at - b.at);
  if (!chords.length) return [{ text: l.text }];
  const segs: { chord?: string; text: string }[] = [];
  if (chords[0].at > 0) segs.push({ text: l.text.slice(0, chords[0].at) });
  chords.forEach((c, i) => segs.push({ chord: c.chord, text: l.text.slice(c.at, chords[i + 1]?.at ?? l.text.length) }));
  return segs;
}

/** YouTube video id from common URL forms, or null. */
export function youtubeId(url: string): string | null {
  const u = url.trim();
  const m =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/|music\.youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/.exec(u);
  return m ? m[1] : null;
}
