"use client";

import { romanNumeral } from "@/lib/music/transpose";
import { cn } from "@/components/ui";
import type { TimelineChord } from "./playback";

/** Bar-by-bar chord chart with roman numerals; highlights the chord that is sounding now. */
export function ChordChart({ chords, songKey, beatsPerBar, current, onSeek }: { chords: TimelineChord[]; songKey: string; beatsPerBar: number; current?: TimelineChord; onSeek?: (c: TimelineChord) => void }) {
  const sections = new Map<string, TimelineChord[][]>();
  for (const c of chords) {
    const bars = sections.get(c.sectionId) ?? [];
    if (!bars[c.bar]) bars[c.bar] = [];
    bars[c.bar].push(c);
    sections.set(c.sectionId, bars);
  }
  const majorKey = songKey.endsWith("m") ? null : songKey;
  return (
    <div className="space-y-3">
      {[...sections.entries()].map(([id, bars]) => (
        <div key={id} className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {bars.map((bar, i) => (
            <div key={i} className="flex min-h-14 rounded-lg border border-border bg-surface-2">
              {bar.map((c) => {
                const active = current && c.start === current.start && c.sectionId === current.sectionId;
                const rn = majorKey ? romanNumeral(c.chord, majorKey) : null;
                return (
                  <button
                    key={c.start}
                    type="button"
                    onClick={() => onSeek?.(c)}
                    aria-current={active ? "true" : undefined}
                    className={cn("flex flex-1 flex-col items-center justify-center rounded-lg px-1 py-1.5 transition-colors", active ? "bg-accent text-accent-fg" : "hover:bg-surface-3")}
                    style={{ flexGrow: c.beats / beatsPerBar }}
                    aria-label={`${c.chord}${rn ? `, ${rn}` : ""}`}
                  >
                    <span className="font-semibold">{c.chord}</span>
                    {rn && <span className={cn("text-[11px]", active ? "opacity-80" : "text-muted")}>{rn}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
