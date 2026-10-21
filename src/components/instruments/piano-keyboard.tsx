"use client";
import { useT } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blackKeyOffset, COMPUTER_KEY_MAP, keysInRange } from "@/lib/music/keyboard";
import { midiToName, mod12 } from "@/lib/music/notes";
import { labelNote, type LabelMode } from "@/lib/music/sargam";
import { pianoAttack, pianoRelease } from "@/lib/audio/engine";
import { usePrefs } from "@/hooks/use-prefs";
import { cn } from "@/components/ui";

export type KeyTone = "target" | "correct" | "wrong" | "hint" | "scale" | "root" | "chord";

export interface PianoKeyboardProps {
  low: number;
  high: number;
  /** Notes held by an external source (MIDI, playback). */
  pressed?: Iterable<number>;
  highlight?: Partial<Record<number, KeyTone>>;
  fingers?: Partial<Record<number, number>>;
  onNoteOn?: (midi: number, source: "pointer" | "keyboard") => void;
  onNoteOff?: (midi: number) => void;
  playSound?: boolean;
  /** Which keys get labels. */
  labels?: "all" | "white" | "c-only" | "none";
  labelMode?: LabelMode;
  /** Enable the A-W-S-E… computer keyboard mapping. */
  computerKeyboard?: boolean;
  /** Width of one white key in px (keyboard scrolls horizontally if wider than the container). */
  whiteKeyWidth?: number;
  height?: number;
  /** Scroll so this note is centred on mount / change. */
  focusMidi?: number;
  className?: string;
  ariaLabel?: string;
}

const TONE_WHITE: Record<KeyTone, string> = {
  target: "!bg-[color-mix(in_oklab,var(--accent)_32%,var(--key-white))] ring-2 ring-inset ring-accent",
  correct: "!bg-[color-mix(in_oklab,var(--success)_38%,var(--key-white))]",
  wrong: "!bg-[color-mix(in_oklab,var(--danger)_38%,var(--key-white))]",
  hint: "!bg-[color-mix(in_oklab,var(--piano)_22%,var(--key-white))]",
  scale: "!bg-[color-mix(in_oklab,var(--piano)_26%,var(--key-white))]",
  root: "!bg-[color-mix(in_oklab,var(--accent)_45%,var(--key-white))]",
  chord: "!bg-[color-mix(in_oklab,var(--theory)_34%,var(--key-white))]",
};
const TONE_BLACK: Record<KeyTone, string> = {
  target: "!bg-accent ring-2 ring-accent",
  correct: "!bg-success",
  wrong: "!bg-danger",
  hint: "!bg-piano",
  scale: "!bg-piano",
  root: "!bg-accent",
  chord: "!bg-theory",
};

export function PianoKeyboard({
  low,
  high,
  pressed,
  highlight = {},
  fingers = {},
  onNoteOn,
  onNoteOff,
  playSound = true,
  labels = "white",
  labelMode,
  computerKeyboard = false,
  whiteKeyWidth = 44,
  height = 190,
  focusMidi,
  className,
  ariaLabel,
}: PianoKeyboardProps) {
  const tr = useT();
  const [prefs] = usePrefs();
  const mode = labelMode ?? prefs.labelMode;
  const keys = useMemo(() => keysInRange(low, high), [low, high]);
  const whites = keys.filter((k) => !k.black);
  const [down, setDown] = useState<Set<number>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);
  const pointerNotes = useRef(new Map<number, number>());
  const [baseC, setBaseC] = useState(() => Math.max(low - mod12(low) + (mod12(low) ? 12 : 0), Math.min(60, high - 12)));

  const external = useMemo(() => new Set(pressed ?? []), [pressed]);
  const blackW = whiteKeyWidth * 0.6;
  const totalW = whites.length * whiteKeyWidth;

  const start = useCallback(
    (midi: number, source: "pointer" | "keyboard") => {
      setDown((d) => new Set(d).add(midi));
      if (playSound) void pianoAttack(midi, 0.8);
      onNoteOn?.(midi, source);
    },
    [onNoteOn, playSound],
  );
  const end = useCallback(
    (midi: number) => {
      setDown((d) => {
        if (!d.has(midi)) return d;
        const n = new Set(d);
        n.delete(midi);
        return n;
      });
      if (playSound) pianoRelease(midi);
      onNoteOff?.(midi);
    },
    [onNoteOff, playSound],
  );

  // Centre on focus note (middle C by default).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = focusMidi ?? 60;
    const k = keys.find((x) => x.midi === target) ?? keys[Math.floor(keys.length / 2)];
    if (!k) return;
    el.scrollLeft = k.whiteIndex * whiteKeyWidth - el.clientWidth / 2 + whiteKeyWidth / 2;
  }, [focusMidi, keys, whiteKeyWidth]);

  // Keys are touch-none (so taps and glissandos play), which means a swipe can't scroll them on a phone.
  // Track the scroll position so we can offer arrow buttons and a draggable bar instead.
  const [view, setView] = useState({ overflow: false, start: 0, size: 1 });
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      const sw = el.scrollWidth;
      setView({ overflow: sw > el.clientWidth + 1, start: el.scrollLeft / sw, size: el.clientWidth / sw });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [totalW]);
  const scrollByOctave = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * 7 * whiteKeyWidth, behavior: "smooth" });
  const dragTrack = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    if (!el || (e.type === "pointermove" && !e.currentTarget.hasPointerCapture(e.pointerId))) return;
    if (e.type === "pointerdown") e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    // Centre the visible window on the finger.
    el.scrollLeft = ((e.clientX - r.left) / r.width) * el.scrollWidth - el.clientWidth / 2;
  };
  const atStart = view.start <= 0.001;
  const atEnd = view.start + view.size >= 0.999;

  // Latest handlers via refs, so a parent passing inline callbacks doesn't re-run the listener
  // effect (whose cleanup releases held notes) on every render.
  const startRef = useRef(start);
  const endRef = useRef(end);
  useEffect(() => {
    startRef.current = start;
    endRef.current = end;
  });

  // Computer keyboard input.
  useEffect(() => {
    if (!computerKeyboard) return;
    const start = (m: number, src: "keyboard") => startRef.current(m, src);
    const end = (m: number) => endRef.current(m);
    const held = new Map<string, number>();
    const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z") return setBaseC((b) => Math.max(b - 12, low - mod12(low)));
      if (k === "x") return setBaseC((b) => Math.min(b + 12, high - mod12(high)));
      const off = COMPUTER_KEY_MAP[k];
      if (off === undefined) return;
      const midi = baseC + off;
      if (midi < low || midi > high) return;
      e.preventDefault();
      held.set(k, midi);
      start(midi, "keyboard");
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const midi = held.get(k);
      if (midi === undefined) return;
      held.delete(k);
      end(midi);
    };
    const onBlur = () => {
      held.forEach((m) => end(m));
      held.clear();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      onBlur();
    };
  }, [computerKeyboard, baseC, low, high]);

  const pointerDown = (midi: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    // Release implicit touch capture so dragging across keys (glissando) fires pointerenter.
    const el = e.currentTarget as HTMLElement;
    try {
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    } catch {
      /* synthetic events have no active pointer */
    }
    pointerNotes.current.set(e.pointerId, midi);
    start(midi, "pointer");
  };
  const pointerEnter = (midi: number) => (e: React.PointerEvent) => {
    // Glissando: dragging with a pressed pointer moves to the next key.
    const prev = pointerNotes.current.get(e.pointerId);
    if (prev === undefined || prev === midi || e.buttons === 0) return;
    end(prev);
    pointerNotes.current.set(e.pointerId, midi);
    start(midi, "pointer");
  };
  const pointerUp = (e: React.PointerEvent) => {
    const prev = pointerNotes.current.get(e.pointerId);
    if (prev === undefined) return;
    pointerNotes.current.delete(e.pointerId);
    end(prev);
  };

  const showLabel = (midi: number, black: boolean) => {
    if (labels === "none") return false;
    if (labels === "c-only") return mod12(midi) === 0;
    if (labels === "white") return !black || prefs.showBlackKeyLabels;
    return true;
  };

  const renderLabel = (midi: number, black: boolean) => {
    const l = labelNote(midi, { mode, tonicPc: prefs.tonicPc, spelling: prefs.spelling });
    const swara = (
      <span className={cn(l.swara.variant === "komal" && "komal")} title={l.swara.full}>
        {l.swara.compact}
      </span>
    );
    const western = mod12(midi) === 0 && !black ? midiToName(midi) : l.western;
    return (
      <span className={cn("pointer-events-none flex flex-col items-center leading-tight", black ? "text-[9px] text-white/85" : "text-[11px] text-black/70")}>
        {mode !== "sargam" && <span className="font-semibold">{western}</span>}
        {mode !== "western" && <span className={cn(mode === "both" && "opacity-75")}>{swara}</span>}
      </span>
    );
  };

  return (
    <div className={cn("relative", className)}>
      <div ref={scroller} className="scrollbar-thin overflow-x-auto overflow-y-hidden rounded-2xl border border-border bg-[var(--key-black)] p-2 pt-3 shadow-card">
        <div
          role="group"
          aria-label={ariaLabel ?? tr("ui.piano_keyboard_2")}
          className="relative mx-auto touch-none select-none"
          style={{ width: totalW, height }}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onPointerLeave={pointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {keys.map((k) => {
            const isDown = down.has(k.midi) || external.has(k.midi);
            const tone = highlight[k.midi];
            const finger = fingers[k.midi];
            const l = labelNote(k.midi, { mode, tonicPc: prefs.tonicPc, spelling: prefs.spelling, withOctave: true });
            const aria = `${midiToName(k.midi, prefs.spelling)}${mode !== "western" ? `, ${l.swara.full}` : ""}${k.isMiddleC ? ", middle C" : ""}`;
            if (!k.black) {
              return (
                <button
                  key={k.midi}
                  type="button"
                  data-midi={k.midi}
                  data-note={midiToName(k.midi)}
                  aria-label={aria}
                  aria-pressed={isDown}
                  onPointerDown={pointerDown(k.midi)}
                  onPointerEnter={pointerEnter(k.midi)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
                      e.preventDefault();
                      start(k.midi, "keyboard");
                    }
                  }}
                  onKeyUp={(e) => (e.key === "Enter" || e.key === " ") && end(k.midi)}
                  className={cn(
                    "absolute top-0 flex flex-col items-center justify-end rounded-b-lg border border-[var(--key-white-edge)] bg-[var(--key-white)] pb-2 transition-[background,transform] duration-75 focus-visible:z-20",
                    tone && TONE_WHITE[tone],
                    isDown && "!bg-[color-mix(in_oklab,var(--accent)_55%,var(--key-white))] translate-y-[1px]",
                  )}
                  style={{ left: k.whiteIndex * whiteKeyWidth, width: whiteKeyWidth, height }}
                >
                  {finger !== undefined && <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-piano text-[11px] font-bold text-white">{finger}</span>}
                  {k.isMiddleC && <span className="mb-1 h-1.5 w-1.5 rounded-full bg-accent" title={tr("ui.middle_c")} aria-hidden />}
                  {showLabel(k.midi, false) && renderLabel(k.midi, false)}
                </button>
              );
            }
            const left = (k.whiteIndex + 1) * whiteKeyWidth - blackW / 2 + blackKeyOffset(k.midi) * whiteKeyWidth;
            return (
              <button
                key={k.midi}
                type="button"
                data-midi={k.midi}
                data-note={midiToName(k.midi)}
                aria-label={aria}
                aria-pressed={isDown}
                onPointerDown={pointerDown(k.midi)}
                onPointerEnter={pointerEnter(k.midi)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
                    e.preventDefault();
                    start(k.midi, "keyboard");
                  }
                }}
                onKeyUp={(e) => (e.key === "Enter" || e.key === " ") && end(k.midi)}
                className={cn(
                  "absolute top-0 z-10 flex flex-col items-center justify-end rounded-b-md bg-gradient-to-b from-[var(--key-black-top)] to-[var(--key-black)] pb-1.5 shadow-md transition-[background] duration-75",
                  tone && TONE_BLACK[tone],
                  isDown && "!from-accent !to-accent-hover",
                )}
                style={{ left, width: blackW, height: height * 0.62 }}
              >
                {finger !== undefined && <span className="mb-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-piano">{finger}</span>}
                {showLabel(k.midi, true) && renderLabel(k.midi, true)}
              </button>
            );
          })}
        </div>
      </div>
      {view.overflow && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByOctave(-1)}
            disabled={atStart}
            aria-label={tr("ui.scroll_keys_left")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-muted hover:text-text disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div
            aria-hidden
            title={tr("ui.drag_to_scroll_keys")}
            className="relative h-8 flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
            onPointerDown={dragTrack}
            onPointerMove={dragTrack}
          >
            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-2" />
            <div
              className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-accent/70"
              style={{ left: `${view.start * 100}%`, width: `${view.size * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => scrollByOctave(1)}
            disabled={atEnd}
            aria-label={tr("ui.scroll_keys_right")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-muted hover:text-text disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {computerKeyboard && (
        <p className="mt-2 text-xs text-muted">
          {tr("ui.kb_help_a")} <kbd className="rounded bg-surface-2 px-1">A</kbd>–<kbd className="rounded bg-surface-2 px-1">;</kbd> {tr("ui.kb_help_b")} <kbd className="rounded bg-surface-2 px-1">W E T Y U O P</kbd> {tr("ui.kb_help_c")} <strong>{midiToName(baseC)}</strong>. <kbd className="rounded bg-surface-2 px-1">Z</kbd>/<kbd className="rounded bg-surface-2 px-1">X</kbd> {tr("ui.kb_help_d")}
        </p>
      )}
    </div>
  );
}
