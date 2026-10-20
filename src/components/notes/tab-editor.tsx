"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronUp, Copy, Delete, FileText, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, cn } from "@/components/ui";
import { uid } from "@/lib/storage/db";
import { useT } from "@/lib/i18n";
import { barCol, emptyCol, isBarCol, parseAsciiTab, tuningLabels, type TabSection } from "@/lib/notes/model";
import { TabStaff } from "./tab-staff";

const TECHNIQUES = [
  { k: "h", label: "h", title: "notes.tech.h" },
  { k: "p", label: "p", title: "notes.tech.p" },
  { k: "/", label: "/", title: "notes.tech.slideUp" },
  { k: "\\", label: "\\", title: "notes.tech.slideDown" },
  { k: "b", label: "b", title: "notes.tech.b" },
  { k: "~", label: "~", title: "notes.tech.vibrato" },
  { k: "x", label: "x", title: "notes.tech.x" },
] as const;

export const SECTION_SUGGESTIONS = ["Intro", "Verse", "Pre-chorus", "Chorus", "Bridge", "Interlude", "Solo", "Outro"];

export function newTabSection(name = "Intro"): TabSection {
  return { id: uid("sec_"), name, cols: Array.from({ length: 8 }, emptyCol) };
}

interface Cursor {
  s: number;
  c: number;
  r: number;
}

/**
 * Tap-to-write tab: tap a spot on a string, then tap fret numbers on the keypad. "Next" moves to
 * the next beat (adding space at the end automatically). Works with a physical keyboard too.
 */
export function TabEditor({ sections, onChange, tuning }: { sections: TabSection[]; onChange: (s: TabSection[]) => void; tuning?: string }) {
  const t = useT();
  const labels = tuningLabels(tuning);
  const [cur, setCur] = useState<Cursor>({ s: 0, c: 0, r: 1 });
  // Right after the cursor moves, the next digit replaces the cell; then digits add up ("1","1" → "11").
  const [fresh, setFresh] = useState(true);
  const [keypad, setKeypad] = useState(true);
  const [importing, setImporting] = useState(false);
  const [ascii, setAscii] = useState("");

  const sec = sections[cur.s] ?? sections[0];
  const cell = sec?.cols[cur.c]?.[cur.r] ?? "";
  const onBar = sec ? isBarCol(sec.cols[cur.c] ?? emptyCol()) : false;

  const updateSection = (s: number, fn: (sec: TabSection) => TabSection) => onChange(sections.map((x, i) => (i === s ? fn(x) : x)));
  const move = (c: Cursor) => {
    setCur(c);
    setFresh(true);
  };

  const setCell = (value: string) => {
    updateSection(cur.s, (x) => ({
      ...x,
      cols: x.cols.map((col, ci) => (ci === cur.c ? (isBarCol(col) ? emptyCol() : col).map((v, r) => (r === cur.r ? value.slice(0, 6) : v)) : col)),
    }));
    setFresh(false);
  };

  const digit = (d: string) => {
    if (!fresh && (/^\d$/.test(cell) || /[hpbr/\\]$/.test(cell))) setCell(cell + d);
    else setCell(d);
  };
  const technique = (k: string) => setCell(k === "x" ? "x" : cell + k);
  const backspace = () => setCell(fresh ? "" : cell.slice(0, -1));

  const next = () => {
    if (cur.c + 1 >= sec.cols.length) updateSection(cur.s, (x) => ({ ...x, cols: [...x.cols, emptyCol()] }));
    move({ ...cur, c: cur.c + 1 });
  };
  const step = (dc: number, dr: number) => {
    const c = Math.max(0, Math.min(sec.cols.length - 1, cur.c + dc));
    // dr is on screen (−1 = line above); strings are drawn bottom-up, see lineOf.
    const r = Math.max(0, Math.min(5, cur.r - dr));
    move({ ...cur, c, r });
  };
  const insertCol = (col: string[]) => {
    updateSection(cur.s, (x) => ({ ...x, cols: [...x.cols.slice(0, cur.c + 1), col, ...x.cols.slice(cur.c + 1)] }));
    move({ ...cur, c: cur.c + 1 });
  };
  const addBar = () => {
    const cols = [...sec.cols.slice(0, cur.c + 1), barCol(), ...sec.cols.slice(cur.c + 1)];
    if (cur.c + 2 >= cols.length) cols.push(emptyCol());
    updateSection(cur.s, (x) => ({ ...x, cols }));
    move({ ...cur, c: cur.c + 2 });
  };
  const deleteCol = () => {
    if (sec.cols.length <= 1) return setCell("");
    updateSection(cur.s, (x) => ({ ...x, cols: x.cols.filter((_, i) => i !== cur.c) }));
    move({ ...cur, c: Math.max(0, Math.min(cur.c, sec.cols.length - 2)) });
  };

  const addSection = (afterIndex = sections.length - 1, copyFrom?: TabSection) => {
    const created = copyFrom ? { ...copyFrom, id: uid("sec_"), cols: copyFrom.cols.map((c) => [...c]) } : newTabSection(sections.length ? "Verse" : "Intro");
    onChange([...sections.slice(0, afterIndex + 1), created, ...sections.slice(afterIndex + 1)]);
    move({ s: afterIndex + 1, c: 0, r: 1 });
  };
  const removeSection = (s: number) => {
    if (sections.length <= 1) return onChange([newTabSection()]);
    onChange(sections.filter((_, i) => i !== s));
    move({ s: Math.max(0, Math.min(cur.s, sections.length - 2)), c: 0, r: 1 });
  };
  const moveSection = (s: number, d: -1 | 1) => {
    const to = s + d;
    if (to < 0 || to >= sections.length) return;
    const copy = [...sections];
    [copy[s], copy[to]] = [copy[to], copy[s]];
    onChange(copy);
    move({ s: to, c: 0, r: cur.r });
  };

  const doImport = () => {
    const { sections: parsed } = parseAsciiTab(ascii);
    if (!parsed.length) return toast.error(t("notes.importNothing"));
    const blank = sections.length === 1 && sections[0].cols.every((c) => c.every((x) => !x));
    const added = parsed.map((p) => ({ id: uid("sec_"), name: p.name, cols: p.cols }));
    onChange(blank ? added : [...sections, ...added]);
    toast.success(t("notes.importDone", { n: added.length }));
    setAscii("");
    setImporting(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input,textarea,select") || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    const handled = (fn: () => void) => {
      e.preventDefault();
      fn();
    };
    if (/^\d$/.test(k)) handled(() => digit(k));
    else if (TECHNIQUES.some((x) => x.k === k.toLowerCase())) handled(() => technique(k.toLowerCase()));
    else if (k === "Backspace") handled(backspace);
    else if (k === "Delete") handled(() => setCell(""));
    else if (k === " " || k === "Enter" || k === "Tab") handled(next);
    else if (k === "|") handled(addBar);
    else if (k === "ArrowLeft") handled(() => step(-1, 0));
    else if (k === "ArrowRight") handled(() => step(1, 0));
    else if (k === "ArrowUp") handled(() => step(0, -1));
    else if (k === "ArrowDown") handled(() => step(0, 1));
  };

  return (
    <div className="space-y-4" onKeyDown={onKeyDown}>
      <datalist id="tab-section-names">
        {SECTION_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {sections.map((s, si) => (
        <Card key={s.id} className={cn("overflow-hidden", si === cur.s && "ring-1 ring-accent/40")} data-testid="tab-section">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/50 px-3 py-2">
            <Input
              value={s.name}
              onChange={(e) => updateSection(si, (x) => ({ ...x, name: e.target.value.slice(0, 40) }))}
              placeholder={t("notes.sectionName")}
              list="tab-section-names"
              aria-label={t("notes.sectionName")}
              className="h-9 min-w-0 flex-1 basis-32"
            />
            <div className="flex items-center">
              <IconBtn label={t("notes.moveUp")} onClick={() => moveSection(si, -1)} disabled={si === 0}>
                <ChevronUp className="h-4 w-4" />
              </IconBtn>
              <IconBtn label={t("notes.moveDown")} onClick={() => moveSection(si, 1)} disabled={si === sections.length - 1}>
                <ChevronDown className="h-4 w-4" />
              </IconBtn>
              <IconBtn label={t("notes.duplicateSection")} onClick={() => addSection(si, s)}>
                <Copy className="h-4 w-4" />
              </IconBtn>
              <IconBtn label={t("notes.deleteSection")} onClick={() => removeSection(si)}>
                <Trash2 className="h-4 w-4" />
              </IconBtn>
            </div>
          </div>
          <div tabIndex={0} className="px-2 pt-3 focus:outline-none sm:px-3" aria-label={t("notes.tabArea")}>
            <TabStaff section={{ ...s, name: "" }} labels={labels} lineGap={30} cursor={si === cur.s ? { col: cur.c, str: cur.r } : null} onCellTap={(c, r) => move({ s: si, c, r })} />
          </div>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => addSection()}>
          <Plus className="h-4 w-4" /> {t("notes.addSection")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setImporting((v) => !v)}>
          <FileText className="h-4 w-4" /> {t("notes.importText")}
        </Button>
      </div>

      {importing && (
        <Card className="space-y-2 p-4">
          <p className="text-sm text-muted">{t("notes.importHint")}</p>
          <textarea
            value={ascii}
            onChange={(e) => setAscii(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={"[Intro]\ne|-----------6--|\nB|-11-9---------|\nG|------11-10-8-|\nD|--------------|\nA|--------------|\nE|--------------|"}
            className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-xs focus:border-accent focus:outline-none sm:text-sm"
            data-testid="tab-import-text"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={doImport} disabled={!ascii.trim()}>
              {t("notes.importAdd")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setImporting(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </Card>
      )}

      {/* Keypad: stays at the bottom of the screen while you write. */}
      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 lg:bottom-3">
        <Card className="p-2 shadow-lg sm:p-3">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <p className="truncate text-xs text-muted" aria-live="polite">
              {t("notes.cursorAt", { string: labels[cur.r], col: cur.c + 1, section: sec?.name || t("notes.sectionN", { n: cur.s + 1 }) })}
              {onBar ? ` · ${t("notes.barLine")}` : ""}
            </p>
            <button type="button" onClick={() => setKeypad((v) => !v)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-surface-2">
              {keypad ? t("notes.hideKeypad") : t("notes.showKeypad")}
            </button>
          </div>
          {keypad && (
            <div className="space-y-1.5" data-testid="tab-keypad">
              <div className="grid grid-cols-6 gap-1.5">
                {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <Key key={d} onClick={() => digit(d)} className="font-mono text-base font-bold" testId={`key-${d}`}>
                    {d}
                  </Key>
                ))}
                <Key onClick={backspace} label={t("notes.erase")}>
                  <Delete className="h-4 w-4" />
                </Key>
                <Key onClick={next} className="bg-accent text-accent-fg hover:bg-accent-hover" label={t("notes.next")} testId="key-next">
                  {t("notes.next")} <ArrowRight className="h-4 w-4" />
                </Key>
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {TECHNIQUES.map((x) => (
                  <Key key={x.k} onClick={() => technique(x.k)} label={t(x.title)} className="font-mono">
                    {x.label}
                  </Key>
                ))}
                <Key onClick={addBar} label={t("notes.addBar")} className="font-mono">
                  |
                </Key>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                <Key onClick={() => step(-1, 0)} label={t("notes.left")}>
                  <ArrowLeft className="h-4 w-4" />
                </Key>
                <Key onClick={() => step(0, -1)} label={t("notes.stringUp")}>
                  <ArrowUp className="h-4 w-4" />
                </Key>
                <Key onClick={() => step(0, 1)} label={t("notes.stringDown")}>
                  <ArrowDown className="h-4 w-4" />
                </Key>
                <Key onClick={() => step(1, 0)} label={t("notes.right")}>
                  <ArrowRight className="h-4 w-4" />
                </Key>
                <Key onClick={() => insertCol(emptyCol())} label={t("notes.insertSpace")}>
                  <Plus className="h-4 w-4" />
                </Key>
                <Key onClick={deleteCol} label={t("notes.deleteColumn")}>
                  <Minus className="h-4 w-4" />
                </Key>
              </div>
              <p className="hidden px-1 pt-1 text-[11px] text-subtle sm:block">{t("notes.keyboardHint")}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Key({ children, onClick, label, className, testId }: { children: ReactNode; onClick: () => void; label?: string; className?: string; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={cn("flex h-11 items-center justify-center gap-1 rounded-lg border border-border bg-surface-2 text-sm font-medium active:scale-95 hover:bg-surface-3 sm:h-10", className)}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-3 hover:text-text disabled:opacity-30">
      {children}
    </button>
  );
}
