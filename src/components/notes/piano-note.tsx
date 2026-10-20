"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowDownToLine, Delete, Play, Plus, Space, Square, Trash2 } from "lucide-react";
import { Button, Card, Input, Switch, cn } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { useT } from "@/lib/i18n";
import { playPianoNote, stopAll } from "@/lib/audio/engine";
import { pcName } from "@/lib/music/notes";
import { uid } from "@/lib/storage/db";
import { melodyMidi, notesUsed, pianoHeading, pianoTokens, type PianoLine } from "@/lib/notes/model";

export const newPianoLine = (): PianoLine => ({ id: uid("ln_"), lyric: "", notes: "" });

/** Plays lines of notes one after another; remembers which line is sounding. */
function usePianoPlayer() {
  const [line, setLine] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    stopAll();
    setLine(null);
  };
  const play = (lines: PianoLine[], step = 0.42) => {
    stop();
    let t = 0;
    for (const l of lines) {
      const midis = melodyMidi(pianoTokens(l.notes));
      if (!midis.length) continue;
      const at = t;
      midis.forEach((m, i) => void playPianoNote(m, step * 0.95, at + i * step));
      timers.current.push(setTimeout(() => setLine(l.id), at * 1000));
      t += midis.length * step + step;
    }
    timers.current.push(setTimeout(() => setLine(null), t * 1000));
  };
  return { line, play, stop };
}

/** Read view, laid out like a handwritten piano sheet: lyric, then the notes under it. */
export function PianoView({ lines }: { lines: PianoLine[] }) {
  const t = useT();
  const [prefs] = usePrefs();
  const used = notesUsed(lines, prefs.spelling);
  const player = usePianoPlayer();

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-muted">{t("notes.notesUsed")}</p>
            <p className="mt-1 text-lg tracking-wide text-success" data-testid="notes-used">
              {used.length ? used.join("  ") : "—"}
            </p>
          </div>
          {player.line ? (
            <Button variant="secondary" size="sm" onClick={player.stop}>
              <Square className="h-4 w-4" /> {t("notes.stop")}
            </Button>
          ) : (
            <Button size="sm" onClick={() => player.play(lines)} disabled={!used.length}>
              <Play className="h-4 w-4" /> {t("notes.playAll")}
            </Button>
          )}
        </div>
        <div className="space-y-5" data-testid="piano-view">
          {lines.map((l) => {
            const heading = pianoHeading(l);
            if (heading) return <p key={l.id} className="pt-2 text-lg font-semibold text-muted">{heading}</p>;
            if (!l.lyric.trim() && !l.notes.trim()) return <div key={l.id} className="h-2" />;
            const playing = player.line === l.id;
            return (
              <div key={l.id} className={cn("group -mx-2 flex items-start gap-2 rounded-xl px-2 py-1 transition-colors", playing && "bg-accent-soft")}>
                <div className="min-w-0 flex-1">
                  {l.lyric.trim() && <p className="whitespace-pre-wrap text-[1.05rem] text-muted">{l.lyric}</p>}
                  {l.notes.trim() && <p className="mt-1 whitespace-pre-wrap text-[1.15rem] font-semibold tracking-wide text-danger">{l.notes}</p>}
                </div>
                {l.notes.trim() && (
                  <button type="button" onClick={() => player.play([l])} className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-accent" aria-label={t("notes.playLine")}>
                    <Play className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          {!lines.some((l) => l.lyric.trim() || l.notes.trim()) && <p className="text-sm text-muted">{t("notes.emptySheet")}</p>}
        </div>
      </Card>
    </div>
  );
}

const WHITE = [0, 2, 4, 5, 7, 9, 11];
/** Black keys sit between whites; null = gap (no black key between E–F and B–C). */
const BLACK = [1, 3, null, 6, 8, 10];

/**
 * Lines of lyric + notes. Tap a notes box, then tap the note pad (laid out like one octave of a
 * piano) — each tap writes the note and plays it, so you can check by ear as you write.
 */
export function PianoEditor({ lines, onChange }: { lines: PianoLine[]; onChange: (l: PianoLine[]) => void }) {
  const t = useT();
  const [prefs] = usePrefs();
  const [active, setActive] = useState<string>(lines[0]?.id ?? "");
  const [withOctave, setWithOctave] = useState(false);
  const [octave, setOctave] = useState(4);
  const caret = useRef<{ id: string; pos: number } | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const player = usePianoPlayer();

  const activeLine = lines.find((l) => l.id === active) ?? lines[lines.length - 1];

  const patch = (id: string, p: Partial<PianoLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const addLine = (afterId?: string) => {
    const l = newPianoLine();
    const i = afterId ? lines.findIndex((x) => x.id === afterId) : lines.length - 1;
    onChange([...lines.slice(0, i + 1), l, ...lines.slice(i + 1)]);
    setActive(l.id);
    caret.current = { id: l.id, pos: 0 };
    requestAnimationFrame(() => inputs.current.get(`${l.id}:lyric`)?.focus());
  };
  const removeLine = (id: string) => {
    const rest = lines.filter((l) => l.id !== id);
    onChange(rest.length ? rest : [newPianoLine()]);
  };

  const notesCaret = (l: PianoLine) => (caret.current?.id === l.id ? Math.min(caret.current.pos, l.notes.length) : l.notes.length);
  const writeNotes = (l: PianoLine, notes: string, pos: number) => {
    patch(l.id, { notes: notes.slice(0, 300) });
    caret.current = { id: l.id, pos };
  };

  const tapNote = (pc: number) => {
    if (!activeLine) return;
    const name = pcName(pc, prefs.spelling) + (withOctave ? octave : "");
    void playPianoNote((octave + 1) * 12 + pc, 0.5);
    const pos = notesCaret(activeLine);
    const before = activeLine.notes.slice(0, pos);
    const after = activeLine.notes.slice(pos).replace(/^ +/, "");
    const lead = before && !before.endsWith(" ") ? " " : "";
    const next = `${before}${lead}${name} ${after}`;
    writeNotes(activeLine, next, before.length + lead.length + name.length + 1);
  };
  const gap = () => {
    if (!activeLine) return;
    const pos = notesCaret(activeLine);
    writeNotes(activeLine, activeLine.notes.slice(0, pos) + "  " + activeLine.notes.slice(pos), pos + 2);
  };
  const eraseNote = () => {
    if (!activeLine) return;
    const pos = notesCaret(activeLine);
    const before = activeLine.notes.slice(0, pos).replace(/\s*\S+\s*$/, (m) => (m.startsWith(" ") ? " " : ""));
    writeNotes(activeLine, before + activeLine.notes.slice(pos), before.length);
  };

  const trackCaret = (l: PianoLine, el: HTMLInputElement) => {
    setActive(l.id);
    caret.current = { id: l.id, pos: el.selectionStart ?? el.value.length };
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t("notes.pianoHint")}</p>
      <ol className="space-y-2.5">
        {lines.map((l, i) => {
          const isActive = l.id === activeLine?.id;
          return (
            <li key={l.id}>
              <Card className={cn("p-2.5 sm:p-3", isActive && "ring-2 ring-accent/50")} onFocusCapture={() => setActive(l.id)} data-testid="piano-line">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs tabular-nums text-subtle">{i + 1}</span>
                  <Input
                    ref={(el) => void (el ? inputs.current.set(`${l.id}:lyric`, el) : inputs.current.delete(`${l.id}:lyric`))}
                    value={l.lyric}
                    onChange={(e) => patch(l.id, { lyric: e.target.value.slice(0, 160) })}
                    placeholder={i === 0 ? t("notes.lyricPlaceholderFirst") : t("notes.lyricPlaceholder")}
                    aria-label={t("notes.lyricLine", { n: i + 1 })}
                    className="h-10 min-w-0 flex-1"
                  />
                  <button type="button" onClick={() => removeLine(l.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-danger" aria-label={t("notes.deleteLine")}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2 pl-7">
                  <Input
                    value={l.notes}
                    onChange={(e) => {
                      patch(l.id, { notes: e.target.value.slice(0, 300) });
                      trackCaret(l, e.target);
                    }}
                    onSelect={(e) => trackCaret(l, e.currentTarget)}
                    onFocus={(e) => trackCaret(l, e.currentTarget)}
                    placeholder={t("notes.notesPlaceholder")}
                    aria-label={t("notes.notesLine", { n: i + 1 })}
                    inputMode="none"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className={cn("h-10 min-w-0 flex-1 font-semibold tracking-wide text-danger", isActive && "border-accent")}
                    data-testid="piano-notes-input"
                  />
                  <button
                    type="button"
                    onClick={() => (player.line === l.id ? player.stop() : player.play([l]))}
                    disabled={!pianoTokens(l.notes).length}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-accent disabled:opacity-30"
                    aria-label={t("notes.playLine")}
                  >
                    {player.line === l.id ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
      <Button variant="secondary" size="sm" onClick={() => addLine()}>
        <Plus className="h-4 w-4" /> {t("notes.addLine")}
      </Button>

      {/* Note pad: one octave laid out like piano keys, pinned to the bottom while you write. */}
      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 lg:bottom-3">
        <Card className="space-y-2 p-2 shadow-lg sm:p-3" data-testid="note-pad">
          <p className="truncate px-1 text-xs text-muted">{t("notes.writingInLine", { n: Math.max(1, lines.findIndex((l) => l.id === activeLine?.id) + 1) })}</p>
          <div className="grid grid-cols-7 gap-1">
            {BLACK.map((pc, i) => (
              <div key={i} style={{ transform: "translateX(50%)" }}>
                {pc !== null && (
                  <NoteKey onClick={() => tapNote(pc)} black testId={`note-${pcName(pc, prefs.spelling)}`}>
                    {pcName(pc, prefs.spelling)}
                  </NoteKey>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {WHITE.map((pc) => (
              <NoteKey key={pc} onClick={() => tapNote(pc)} testId={`note-${pcName(pc)}`}>
                {pcName(pc)}
              </NoteKey>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1">
            <PadBtn onClick={gap}>
              <Space className="h-4 w-4" /> {t("notes.gap")}
            </PadBtn>
            <PadBtn onClick={eraseNote}>
              <Delete className="h-4 w-4" /> {t("notes.erase")}
            </PadBtn>
            <PadBtn onClick={() => addLine(activeLine?.id)}>
              <ArrowDownToLine className="h-4 w-4" /> {t("notes.newLine")}
            </PadBtn>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
            <div className="min-w-[12rem] flex-1">
              <Switch checked={withOctave} onChange={setWithOctave} label={<span className="text-xs">{t("notes.writeOctave")}</span>} />
            </div>
            <div className="flex items-center gap-1" role="radiogroup" aria-label={t("notes.octave")}>
              <span className="text-xs text-muted">{t("notes.octave")}</span>
              {[3, 4, 5].map((o) => (
                <button key={o} type="button" role="radio" aria-checked={octave === o} onClick={() => setOctave(o)} className={cn("h-8 w-8 rounded-lg text-xs font-semibold", octave === o ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function NoteKey({ children, onClick, black, testId }: { children: ReactNode; onClick: () => void; black?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex w-full items-center justify-center rounded-lg font-semibold shadow-sm active:scale-95",
        black ? "h-10 bg-[#1f1f24] text-xs text-white dark:bg-[#0b0b0e]" : "h-12 border border-border-strong bg-white text-sm text-[#1f1f24] dark:bg-[#ececec]",
      )}
    >
      {children}
    </button>
  );
}

function PadBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2 text-xs font-medium hover:bg-surface-3 active:scale-95">
      {children}
    </button>
  );
}
