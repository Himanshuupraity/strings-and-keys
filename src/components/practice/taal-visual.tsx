"use client";

import { cn } from "@/components/ui";
import { markAt, type Taal } from "@/lib/music/taal";

/**
 * Taal cycle display: matras grouped into vibhags, with bols, sam (X) / khali (0) / tali markers,
 * the currently sounding matra highlighted, and optional "hit" matras (e.g. strum strokes).
 */
export function TaalVisual({
  taal,
  current = -1,
  hits,
  strokes,
  className,
}: {
  taal: Taal;
  /** Matra being played now (0-based), or -1. */
  current?: number;
  /** Matras the student plays (others are dimmed). Defaults to all. */
  hits?: number[];
  /** Optional per-matra label replacing the bol (e.g. D / U / -). */
  strokes?: string[];
  className?: string;
}) {
  let m = 0;
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="img" aria-label={`${taal.name}: ${taal.matras} matras, ${taal.vibhag.join("+")}. Bols ${taal.bols.join(" ")}.`}>
      {taal.vibhag.map((len, v) => {
        const cells = Array.from({ length: len }, () => m++);
        return (
          <div key={v} className="flex gap-1 rounded-xl border border-border bg-surface-2 p-1">
            {cells.map((i) => {
              const mark = markAt(taal, i);
              const on = !hits || hits.includes(i);
              const active = current === i;
              const label = strokes?.[i] ?? taal.bols[i];
              return (
                <div
                  key={i}
                  className={cn(
                    "flex w-11 flex-col items-center rounded-lg px-1 py-1.5 transition-colors sm:w-12",
                    active ? "bg-accent text-accent-fg" : on ? "bg-surface" : "bg-transparent opacity-45",
                  )}
                >
                  <span className={cn("h-4 text-[11px] font-bold leading-4", active ? "" : mark === "X" ? "text-accent" : mark === "0" ? "text-piano" : "text-muted")}>{mark ?? ""}</span>
                  <span className="text-sm font-semibold">{label}</span>
                  <span className={cn("text-[10px]", active ? "" : "text-subtle")}>{i + 1}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
