"use client";
import { useT, useTx } from "@/lib/i18n";

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
  const tr = useT();
  const tx = useTx();
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
      <CardHeader icon={<Layers className="h-5 w-5" />} title={tr("ui.chord_explorer")} description={tr("ui.pick_a_chord_to_see_every_shape_we_know_the_note")} />
      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="block font-medium">{tr("ui.root")}</span>
            <Select aria-label={tr("ui.chord_root")} value={root} onChange={(e) => { setRoot(e.target.value); setIdx(0); }}>
              {ROOT_NAMES.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block font-medium">{tr("ui.type")}</span>
            <Select aria-label={tr("ui.chord_type")} value={quality} onChange={(e) => { setQuality(e.target.value); setIdx(0); }}>
              {QUALITIES.map((q) => <option key={q} value={q}>{tx(CHORD_QUALITIES[q].name)}{q ? ` (${q})` : ""}</option>)}
            </Select>
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => play("down")} disabled={!shape}><ArrowDown className="h-4 w-4" /> {tr("ui.strum_down")}</Button>
            <Button variant="secondary" onClick={() => play("up")} disabled={!shape}><ArrowUp className="h-4 w-4" /> {tr("ui.strum_up")}</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{symbol}</span>
          <span className="text-muted">{tr("ui.quality_chord_notes", { quality: tx(CHORD_QUALITIES[quality].name) })}</span>
          {notes.map((n) => <Badge key={n} tone="theory">{n}</Badge>)}
        </div>

        {shapes.length === 0 ? (
          <Callout tone="warn" title={tr("ui.no_shape_in_our_library_yet")}>{tr("ui.we_only_show_shapes_we_have_checked_note_by_note")}</Callout>
        ) : (
          <>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin" role="listbox" aria-label={tr("ui.chord_shapes")}>
              {shapes.map((s, i) => (
                <button key={i} type="button" role="option" aria-selected={i === idx} onClick={() => { setIdx(i); ping(); void strum(shapeMidi(s)); }} className="shrink-0 text-left">
                  <ChordDiagram shape={s} playable={false} highlight={i === idx} subtitle={s.name ? tx(s.name) : (s.kind === "open" ? tr("ui.open_position") : s.kind)} />
                </button>
              ))}
            </div>
            {shape && (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone={shape.difficulty <= 2 ? "success" : shape.difficulty <= 3 ? "warn" : "danger"}>{tr("ui.difficulty_cap_n5", { n: shape.difficulty })}</Badge>
                  <Badge>{shape.kind === "barre" ? tr("ui.barre_chord_index_finger_presses_several_strings") : shape.kind === "power" ? tr("ui.power_chord_root_fifth") : shape.kind === "partial" ? tr("ui.small_barre") : tr("ui.open_chord")}</Badge>
                </div>
                <Fretboard frets={Math.max(12, Math.max(...shape.frets) + 2)} marks={shapeMarks(shape.frets, shape.fingers)} mutedStrings={shape.frets.flatMap((f, s) => (f < 0 ? [s] : []))} onPlay={ping} />
                {shape.tips && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                    {shape.tips.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                )}
                <p className="text-xs text-muted">{tr("ui.numbers_are_fingers_1_index_2_middle_3_ring_4_li")}</p>
              </>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
