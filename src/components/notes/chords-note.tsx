"use client";

import { useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, Segmented, cn } from "@/components/ui";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { ChordTag } from "@/components/songs/sheet/chord-tag";
import { useT } from "@/lib/i18n";
import { guessKey, isChordToken, parseSheet, transposeSheet, uniqueChords, type SheetLine } from "@/lib/sheet/parse";
import { transposeKey } from "@/lib/music/transpose";

const COMMON_CHORDS = ["C", "D", "Dm", "E", "Em", "F", "G", "A", "Am", "Bm", "Bb", "B7"];
const SECTIONS = ["Intro", "Verse", "Chorus", "Bridge", "Interlude", "Outro"];

/**
 * Phones and Macs turn a quick double space into ". " — handy in messages, but chord lines are
 * spaced out on purpose. If the only change is one space becoming ". ", put the spaces back.
 */
export function undoDoubleSpacePeriod(prev: string, next: string): string {
  if (next.length !== prev.length + 1) return next;
  let i = 0;
  while (i < prev.length && prev[i] === next[i]) i++;
  return prev[i] === " " && next.slice(i, i + 2) === ". " && next.slice(i + 2) === prev.slice(i + 1) ? prev.slice(0, i) + "  " + prev.slice(i + 1) : next;
}

/** Chords sit above the letter they were placed on; when two would overlap, the later one moves right. */
function placeChords(chords: { chord: string; col: number }[]) {
  let end = 0;
  return [...chords]
    .sort((a, b) => a.col - b.col)
    .map((c) => {
      const col = Math.max(c.col, end);
      end = col + c.chord.length + 1;
      return { chord: c.chord, col };
    });
}

function ChordRow({ items }: { items: { chord: string; col: number }[] }) {
  const placed = placeChords(items);
  const width = Math.max(...placed.map((c) => c.col + c.chord.length + 1));
  return (
    <div className="relative h-[1.5em] whitespace-pre" style={{ minWidth: `${width}ch` }} aria-hidden>
      {placed.map((c, i) => (
        <span key={i} className="absolute top-0 -ml-[0.2ch]" style={{ left: `${c.col}ch` }}>
          <ChordTag chord={c.chord} />
        </span>
      ))}
    </div>
  );
}

function SheetLineView({ line }: { line: SheetLine }) {
  if (line.kind === "blank") return <div className="h-[1.2em]" />;
  if (line.kind === "section") return <div className="mb-1 mt-4 text-muted first:mt-0">[{line.name}]</div>;
  if (line.kind === "chords") {
    const cols = line.cols ?? line.chords.map((_, i) => i * 6);
    return <ChordRow items={line.chords.map((chord, i) => ({ chord, col: cols[i] ?? i * 6 }))} />;
  }
  return (
    <div className="mb-0.5" aria-label={`${line.text.trim()}${line.chords.length ? ` (chords: ${line.chords.map((c) => c.chord).join(", ")})` : ""}`}>
      {line.chords.length > 0 && <ChordRow items={line.chords.map((c) => ({ chord: c.chord, col: c.col ?? c.at }))} />}
      <p className="whitespace-pre leading-[1.45]">{line.text || " "}</p>
    </div>
  );
}

/** Read view: printed chord-sheet look, with transpose and text size. */
export function ChordsView({ text, capo = 0 }: { text: string; capo?: number }) {
  const t = useT();
  const [shift, setShift] = useState(0);
  // Smaller on phones so typical chord-sheet lines fit without scrolling sideways.
  const [size, setSize] = useState(() => (typeof window !== "undefined" && window.innerWidth < 640 ? 13 : 15));
  const parsed = useMemo(() => parseSheet(text).lines, [text]);
  const key = useMemo(() => guessKey(parsed), [parsed]);
  const lines = useMemo(() => transposeSheet(parsed, shift, shift ? transposeKey(key, shift) : undefined), [parsed, shift, key]);
  const chords = useMemo(() => uniqueChords(lines), [lines]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Stepper label={t("notes.transpose")} value={shift > 0 ? `+${shift}` : String(shift)} onDec={() => setShift((s) => Math.max(-11, s - 1))} onInc={() => setShift((s) => Math.min(11, s + 1))} />
        <Stepper label={t("notes.textSize")} value={`${size}`} onDec={() => setSize((s) => Math.max(11, s - 1))} onInc={() => setSize((s) => Math.min(24, s + 1))} />
        {capo > 0 && <span className="rounded-full bg-guitar-soft px-2.5 py-1 text-xs font-medium text-guitar">{t("notes.capoOn", { n: capo })}</span>}
      </div>
      <Card className="overflow-x-auto p-4 sm:p-5">
        <div className="font-mono" style={{ fontSize: size }} data-testid="chords-view">
          {lines.length ? lines.map((l, i) => <SheetLineView key={i} line={l} />) : <p className="font-sans text-sm text-muted">{t("notes.emptySheet")}</p>}
        </div>
      </Card>
      {chords.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">{t("notes.chordsUsed")}</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {chords.map((c) => (
              <ChordDiagram key={c} chord={c} size="sm" capo={capo} className="shrink-0" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ label, value, onDec, onInc }: { label: string; value: string; onDec: () => void; onInc: () => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-2 p-1">
      <span className="px-2 text-xs text-muted">{label}</span>
      <button type="button" onClick={onDec} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-3" aria-label={`${label} −`}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-7 text-center font-mono text-sm tabular-nums">{value}</span>
      <button type="button" onClick={onInc} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-3" aria-label={`${label} +`}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Write chords over lyrics. On a phone, lining chords up with spaces is fiddly, so tapping a chord
 * chip drops "[Am]" right where the cursor is — it is shown above that word in the preview.
 */
export function ChordsEditor({ text, onChange }: { text: string; onChange: (s: string) => void }) {
  const t = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  const sel = useRef({ start: text.length, end: text.length });
  const [view, setView] = useState<"write" | "preview">("write");
  const [extra, setExtra] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const used = useMemo(() => uniqueChords(parseSheet(text).lines), [text]);
  const chips = useMemo(() => Array.from(new Set([...used, ...extra, ...COMMON_CHORDS])), [used, extra]);

  const remember = () => {
    const el = ref.current;
    if (el) sel.current = { start: el.selectionStart, end: el.selectionEnd };
  };
  const insert = (snippet: string, ownLine = false) => {
    const { start, end } = sel.current;
    const before = text.slice(0, start);
    const after = text.slice(end);
    let s = snippet;
    if (ownLine) {
      if (before && !before.endsWith("\n")) s = "\n" + s;
      s += "\n";
    }
    const next = before + s + after;
    onChange(next);
    const pos = before.length + s.length;
    sel.current = { start: pos, end: pos };
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(pos, pos);
    });
  };
  const addCustom = () => {
    const c = custom.trim();
    if (!c) return;
    if (!isChordToken(c)) return toast.error(t("notes.unknownChord", { chord: c }));
    setExtra((x) => (x.includes(c) ? x : [c, ...x]));
    insert(`[${c}]`);
    setCustom("");
  };

  const editor = (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted">{t("notes.tapToInsertSection")}</p>
        <div className="flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => (
            <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(`[${s}]`, true)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-piano hover:bg-surface-2">
              [{s}]
            </button>
          ))}
        </div>
        <p className="pt-1 text-xs font-medium text-muted">{t("notes.tapToInsertChord")}</p>
        <div className="flex flex-wrap gap-1.5" data-testid="chord-chips">
          {chips.map((c) => (
            <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(`[${c}]`)} className={cn("min-w-10 rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold", used.includes(c) ? "bg-guitar-soft text-guitar" : "bg-surface-3 text-text")}>
              {c}
            </button>
          ))}
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              addCustom();
            }}
          >
            <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t("notes.otherChord")} aria-label={t("notes.otherChord")} className="h-9 w-24 font-mono" />
            <Button type="submit" size="sm" variant="secondary" disabled={!custom.trim()} aria-label={t("notes.addChord")}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => {
          onChange(undoDoubleSpacePeriod(text, e.target.value));
          sel.current = { start: e.target.selectionStart, end: e.target.selectionEnd };
        }}
        onSelect={remember}
        onBlur={remember}
        rows={18}
        wrap="off"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        placeholder={t("notes.chordsPlaceholder")}
        className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-sm leading-relaxed focus:border-accent focus:outline-none"
        data-testid="chords-text"
      />
      <p className="text-xs text-muted">{t("notes.chordsHint")}</p>
    </div>
  );

  return (
    <div>
      <Segmented
        className="mb-3 lg:hidden"
        label={t("notes.editorView")}
        value={view}
        onChange={setView}
        options={[
          { value: "write", label: t("notes.write") },
          { value: "preview", label: t("notes.preview") },
        ]}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cn(view !== "write" && "hidden lg:block")}>{editor}</div>
        <div className={cn(view !== "preview" && "hidden lg:block")}>
          <p className="mb-2 hidden text-xs font-medium text-muted lg:block">{t("notes.preview")}</p>
          <ChordsView text={text} />
        </div>
      </div>
    </div>
  );
}
