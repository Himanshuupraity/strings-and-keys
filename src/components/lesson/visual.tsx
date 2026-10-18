"use client";
import { useT } from "@/lib/i18n";

import type { Visual } from "@/content/types";
import { PianoKeyboard, type KeyTone } from "@/components/instruments/piano-keyboard";
import { Fretboard, type FretMark } from "@/components/instruments/fretboard";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { Staff } from "@/components/instruments/staff";
import { Illustration } from "./illustrations";
import { keyboardRange, toMidi } from "./utils";

export function VisualRenderer({ visual, onInteract }: { visual: Visual; onInteract?: () => void }) {
  const tr = useT();
  let body: React.ReactNode = null;
  switch (visual.type) {
    case "keyboard": {
      const hl = (visual.highlight ?? []).map(toMidi);
      const range = visual.low !== undefined && visual.high !== undefined ? { low: visual.low, high: visual.high } : keyboardRange(hl, 13);
      const highlight: Partial<Record<number, KeyTone>> = Object.fromEntries(hl.map((m) => [m, "target" as KeyTone]));
      const fingers = Object.fromEntries(Object.entries(visual.fingers ?? {}).map(([n, f]) => [toMidi(n), f]));
      body = <PianoKeyboard low={range.low} high={range.high} highlight={highlight} fingers={fingers} labels={visual.showLabels === false ? "c-only" : "white"} whiteKeyWidth={40} height={160} focusMidi={hl[0]} onNoteOn={onInteract} />;
      break;
    }
    case "fretboard": {
      const marks: FretMark[] = (visual.highlight ?? []).map((h) => ({ string: h.string, fret: h.fret, label: h.label, tone: "target" }));
      body = <Fretboard frets={visual.frets ?? 12} marks={marks} highlightPitchClasses={visual.highlightPitchClasses} onPlay={onInteract} />;
      break;
    }
    case "chord-diagram":
      body = (
        <div className="flex flex-wrap gap-3">
          {visual.chords.map((c) => (
            <ChordDiagram key={c} chord={c} />
          ))}
        </div>
      );
      break;
    case "staff":
      body = <Staff clef={visual.clef} notes={visual.notes} timeSignature={visual.timeSignature} />;
      break;
    case "tab":
      body = (
        <pre className="scrollbar-thin overflow-x-auto rounded-2xl border border-border bg-surface-2 p-4 font-mono text-sm leading-6 text-text" aria-label={tr("ui.guitar_tablature_top_line_is_the_high_e_string")}>
          {visual.lines.join("\n")}
        </pre>
      );
      break;
    case "image-svg":
      body = (
        <div className="rounded-2xl border border-border bg-surface-2 p-4">
          <Illustration svg={visual.svg} />
        </div>
      );
      break;
  }
  return (
    <figure className="space-y-2">
      {body}
      {visual.caption && <figcaption className="text-sm text-muted">{visual.caption}</figcaption>}
    </figure>
  );
}
