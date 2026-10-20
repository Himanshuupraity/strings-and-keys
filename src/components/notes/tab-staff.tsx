"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";
import { playGuitarNote } from "@/lib/audio/engine";
import { cellFret, isBarCol, tuningMidi, type TabSection } from "@/lib/notes/model";

const GUTTER = 40;
const TOP = 14;

/**
 * Line (0 = top) that a string is drawn on. Cells are stored high e first, as in text tab, but
 * drawn with low E on the top line so the staff reads E A D G B E from top to bottom.
 */
export const lineOf = (str: number) => 5 - str;

/** Columns grow with their longest cell ("11", "6/7h9"), bar lines are thin. */
function colWidth(col: string[]) {
  if (isBarCol(col)) return 14;
  return Math.max(30, 12 + 8.5 * Math.max(...col.map((c) => c.length)));
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Splits columns into rows that fit the available width (keeps each column's original index). */
function wrap(cols: string[][], width: number): { col: string[]; index: number }[][] {
  const avail = Math.max(160, width - GUTTER - 16);
  const rows: { col: string[]; index: number }[][] = [[]];
  let used = 0;
  cols.forEach((col, index) => {
    const w = colWidth(col);
    if (used + w > avail && rows[rows.length - 1].length) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push({ col, index });
    used += w;
  });
  return rows;
}

export interface StaffCursor {
  col: number;
  str: number;
}

/**
 * One tab section drawn like printed tab: six lines with string names, "TAB" at the start and
 * fret numbers sitting on the lines. Wraps onto more rows on narrow screens.
 */
export function TabStaff({
  section,
  labels,
  lineGap = 22,
  cursor,
  playing,
  onCellTap,
  className,
}: {
  section: Pick<TabSection, "name" | "cols">;
  labels: string[];
  lineGap?: number;
  cursor?: StaffCursor | null;
  playing?: number | null;
  onCellTap?: (col: number, str: number) => void;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const rows = width ? wrap(section.cols, width) : [];
  const height = TOP * 2 + lineGap * 5;

  return (
    <div ref={ref} className={cn("min-w-0", className)}>
      {section.name && <p className="mb-1 pl-10 font-mono text-sm italic text-piano">{section.name}</p>}
      {rows.map((row, ri) => {
        const rowWidth = row.reduce((s, c) => s + colWidth(c.col), 0) + 10;
        const last = ri === rows.length - 1;
        let x = GUTTER;
        return (
          <div key={ri} className="relative mb-4 select-none" style={{ height }}>
            {labels.map((l, r) => (
              <span key={r} className="absolute left-0 w-3 text-center text-[11px] font-medium leading-none text-muted" style={{ top: TOP + lineOf(r) * lineGap - 5 }} aria-hidden>
                {l}
              </span>
            ))}
            <span className="absolute left-[18px] font-mono text-[13px] font-bold leading-[1.05] text-muted" style={{ top: TOP + lineGap * 1.1 }} aria-hidden>
              T<br />A<br />B
            </span>
            {labels.map((_, r) => (
              <div key={r} className="absolute h-px bg-border-strong" style={{ top: TOP + r * lineGap, left: GUTTER - 8, width: rowWidth }} />
            ))}
            <div className="absolute w-[2px] bg-text/70" style={{ top: TOP, height: lineGap * 5 + 1, left: GUTTER - 8 }} />
            {last && (
              <div className="absolute flex gap-[3px]" style={{ top: TOP, height: lineGap * 5 + 1, left: GUTTER - 8 + rowWidth - 6 }}>
                <span className="w-px bg-text/70" />
                <span className="w-[3px] bg-text/80" />
              </div>
            )}
            {row.map(({ col, index }) => {
              const w = colWidth(col);
              const left = x;
              x += w;
              const active = cursor?.col === index;
              const isPlaying = playing === index;
              return (
                <div key={index} className="absolute top-0 h-full" style={{ left, width: w }}>
                  {(active || isPlaying) && <div className={cn("absolute inset-y-1 inset-x-0.5 rounded-md", isPlaying ? "bg-success-soft" : "bg-accent-soft/70")} />}
                  {isBarCol(col) ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      disabled={!onCellTap}
                      onClick={() => onCellTap?.(index, cursor?.str ?? 0)}
                      className="absolute left-1/2 w-px -translate-x-1/2 bg-text/70 disabled:cursor-default"
                      style={{ top: TOP, height: lineGap * 5 }}
                      aria-label="Bar line"
                    />
                  ) : (
                    col.map((cell, r) => {
                      const sel = active && cursor?.str === r;
                      const Tag = onCellTap ? "button" : "span";
                      return (
                        <Tag
                          key={r}
                          {...(onCellTap ? { type: "button" as const, tabIndex: -1, onClick: () => onCellTap(index, r), "aria-label": `${labels[r]} string, column ${index + 1}${cell ? `: ${cell}` : ""}` } : {})}
                          className="absolute inset-x-0 flex items-center justify-center"
                          style={{ top: TOP + lineOf(r) * lineGap - lineGap / 2, height: lineGap }}
                          data-cell={onCellTap ? `${index}:${r}` : undefined}
                        >
                          {(cell || sel) && (
                            <span
                              className={cn(
                                "min-w-[1.1em] rounded px-[2px] text-center font-mono text-[14px] font-bold leading-[1.2] text-text",
                                sel ? "bg-accent text-accent-fg ring-2 ring-accent/40" : "bg-surface",
                                !cell && sel && "h-[1.2em]",
                              )}
                            >
                              {cell}
                            </span>
                          )}
                        </Tag>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Plays tab columns one after another on the guitar sound and reports which column is sounding. */
export function useTabPlayer(tuning: string | undefined, capo = 0) {
  const [pos, setPos] = useState<{ s: number; c: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPos(null);
  }, []);
  useEffect(() => stop, [stop]);

  const play = useCallback(
    (sections: Pick<TabSection, "cols">[], step: number, from?: { s: number; c: number }) => {
      stop();
      const open = tuningMidi(tuning);
      let t = 0;
      sections.forEach((sec, s) => {
        if (from && s < from.s) return;
        sec.cols.forEach((col, c) => {
          if (from && s === from.s && c < from.c) return;
          if (isBarCol(col)) return;
          const at = t;
          col.forEach((cell, r) => {
            const fret = cellFret(cell);
            if (fret !== null) void playGuitarNote(open[5 - r] + capo + fret, at, 1.4);
          });
          timers.current.push(setTimeout(() => setPos({ s, c }), at * 1000));
          t += step;
        });
      });
      timers.current.push(setTimeout(() => setPos(null), t * 1000 + 200));
    },
    [tuning, capo, stop],
  );

  return { pos, play, stop, playing: pos !== null };
}
