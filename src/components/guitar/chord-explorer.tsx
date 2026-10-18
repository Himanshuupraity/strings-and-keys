"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Layers } from "lucide-react";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { Fretboard, type FretMark } from "@/components/instruments/fretboard";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Select } from "@/components/ui";
import { strum } from "@/lib/audio/engine";
import { CHORD_QUALITIES, chordNoteNames, shapeMidi, shapesForChord } from "@/lib/music/chords";
import { usePracticeLog } from "@/hooks/use-practice-log";

export const ROOT_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const QUALITIES = ["", "m", "7", "m7", "maj7", "sus2", "sus4", "5"];

export function shapeMarks(frets: number[], fingers: number[]): FretMark[] {
  return frets.flatMap((f, s) => (f < 0 ? [] : [{ string: s, fret: f, tone: "chord" as const, finger: fingers[s] > 0 ? fingers[s] : undefined, label: f === 0 ? "○" : undefined }]));
}

export function ChordExplorer() {
  const [root, setRoot] = useState("G");
  const [quality, setQuality] = useState("");
  const [idx, setIdx] = useState(0);
  const { ping } = usePracticeLog("Guitar Lab: chords", { instrument: "guitar" });
  const symbol = root + quality;
  const shapes = useMemo(() => shapesForChord(symbol), [symbol]);
  const shape = shapes[Math.min(idx, shapes.length - 1)];
  const notes = chordNoteNames(symbol);

  const play = (dir: "down" | "up") => {
    if (!shape) return;
    ping();
    void strum(shapeMidi(shape), dir);
  };

  return (
    <Card>
      <CardHeader icon={<Layers className="h-5 w-5" />} title="Chord explorer" description="Pick a chord to see every shape we know, the notes inside it, and where your fingers go." />
      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="block font-medium">Root</span>
            <Select aria-label="Chord root" value={root} onChange={(e) => { setRoot(e.target.value); setIdx(0); }}>
              {ROOT_NAMES.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block font-medium">Type</span>
            <Select aria-label="Chord type" value={quality} onChange={(e) => { setQuality(e.target.value); setIdx(0); }}>
              {QUALITIES.map((q) => <option key={q} value={q}>{CHORD_QUALITIES[q].name}{q ? ` (${q})` : ""}</option>)}
            </Select>
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => play("down")} disabled={!shape}><ArrowDown className="h-4 w-4" /> Strum down</Button>
            <Button variant="secondary" onClick={() => play("up")} disabled={!shape}><ArrowUp className="h-4 w-4" /> Strum up</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{symbol}</span>
          <span className="text-muted">= {CHORD_QUALITIES[quality].name} chord, notes</span>
          {notes.map((n) => <Badge key={n} tone="theory">{n}</Badge>)}
        </div>

        {shapes.length === 0 ? (
          <Callout tone="warn" title="No shape in our library yet">We only show shapes we have checked note-by-note. Try a different type or root.</Callout>
        ) : (
          <>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin" role="listbox" aria-label="Chord shapes">
              {shapes.map((s, i) => (
                <button key={i} type="button" role="option" aria-selected={i === idx} onClick={() => { setIdx(i); ping(); void strum(shapeMidi(s)); }} className="shrink-0 text-left">
                  <ChordDiagram shape={s} playable={false} highlight={i === idx} subtitle={s.name ?? (s.kind === "open" ? "Open position" : s.kind)} />
                </button>
              ))}
            </div>
            {shape && (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone={shape.difficulty <= 2 ? "success" : shape.difficulty <= 3 ? "warn" : "danger"}>Difficulty {shape.difficulty}/5</Badge>
                  <Badge>{shape.kind === "barre" ? "Barre chord — index finger presses several strings" : shape.kind === "power" ? "Power chord — root + fifth" : shape.kind === "partial" ? "Small barre" : "Open chord"}</Badge>
                </div>
                <Fretboard frets={Math.max(12, Math.max(...shape.frets) + 2)} marks={shapeMarks(shape.frets, shape.fingers)} mutedStrings={shape.frets.flatMap((f, s) => (f < 0 ? [s] : []))} onPlay={ping} />
                {shape.tips && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                    {shape.tips.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                )}
                <p className="text-xs text-muted">Numbers are fingers: 1 index · 2 middle · 3 ring · 4 little. ○ = open string, × = don&apos;t play.</p>
              </>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
