"use client";
import { useT } from "@/lib/i18n";

import { useMemo, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Fretboard, type FretMark } from "@/components/instruments/fretboard";
import { MicButton } from "@/components/instruments/mic-button";
import { Button, cn } from "@/components/ui";
import { useNoteInput, type NoteSource } from "@/hooks/use-note-input";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { playSequence } from "@/lib/audio/engine";
import { STANDARD_TUNING } from "@/lib/music/guitar";
import { midiToName } from "@/lib/music/notes";
import { mistakeSummary, sequenceAccuracy, startSequence, stepSequence } from "@/lib/exercises/sequence";
import { ResultSummary, saveGuitarResult, TabView } from "./shared";

export interface SequencePosition {
  string: number;
  fret: number;
}

/** Play a melody or scale from tab; checked note-by-note from the virtual neck or the microphone. */
export function SequenceExercise({ id, skill, positions, intro, step = 0.45 }: { id: string; skill: string; positions: SequencePosition[]; intro: string; step?: number }) {
  const tr = useT();
  const targets = useMemo(() => positions.map((p) => STANDARD_TUNING[p.string] + p.fret), [positions]);
  const [state, setState] = useState(() => startSequence(targets));
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [usedMic, setUsedMic] = useState(false);
  const { ping } = usePracticeLog(`Guitar exercise: ${id}`, { instrument: "guitar" });

  const handle = (midi: number, source: NoteSource) => {
    if (state.done) return;
    ping();
    if (source === "mic") setUsedMic(true);
    const r = stepSequence(state, midi);
    setState(r.state);
    if (r.verdict === "wrong") setFlash({ ok: false, text: tr(midi > r.expected! ? "ui.seq_wrong_lower" : "ui.seq_wrong_higher", { note: midiToName(midi), next: midiToName(r.expected!) }) });
    else if (r.verdict === "correct") setFlash({ ok: true, text: `${midiToName(midi)} ✓` });
    if (r.state.done) {
      const acc = sequenceAccuracy(r.state);
      void saveGuitarResult({ exerciseId: id, skill, input: source === "mic" || usedMic ? "mic" : "virtual", correct: Math.round(acc * targets.length), total: targets.length, measured: true });
    }
  };

  const { mic } = useNoteInput((midi, source) => source === "mic" && handle(midi, "mic"));

  const marks: FretMark[] = positions.flatMap((p, i): FretMark[] => {
    if (i < state.index) return [{ ...p, tone: "correct" }];
    if (i === state.index) return [{ ...p, tone: "target" }];
    return [];
  });

  const reset = () => {
    setState(startSequence(targets));
    setFlash(null);
  };

  if (state.done) {
    const acc = sequenceAccuracy(state);
    return (
      <ResultSummary title={tr("ui.sequence_complete")} correct={Math.round(acc * targets.length)} total={targets.length} source="measured" onRetry={reset}>
        {mistakeSummary(state, (m) => midiToName(m)) ?? tr("ui.every_note_right_first_time")} Score counts notes played right on the first try.
      </ResultSummary>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">{intro}</p>
      <TabView positions={positions} current={state.index} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void playSequence("guitar", targets, step)}><Play className="h-4 w-4" /> {tr("ui.hear_it")}</Button>
        <Button variant="ghost" onClick={reset}><RotateCcw className="h-4 w-4" /> {tr("ui.restart")}</Button>
      </div>
      <Fretboard frets={8} marks={marks} onPlay={(p) => handle(p.midi, "virtual")} />
      <MicButton status={mic.status} error={mic.error} onStart={mic.start} onStop={mic.stop} label={tr("ui.check_with_my_real_guitar")} />
      {flash && <p className={cn("text-sm font-medium", flash.ok ? "text-success" : "text-danger")} role="status">{flash.text}</p>}
    </div>
  );
}

/** Ode to Joy (Beethoven, public domain) — first phrase on the top two strings. */
export const ODE_TO_JOY: SequencePosition[] = [
  [5, 0], [5, 0], [5, 1], [5, 3], [5, 3], [5, 1], [5, 0], [4, 3], [4, 1], [4, 1], [4, 3], [5, 0], [5, 0], [4, 3], [4, 3],
].map(([string, fret]) => ({ string, fret }));

/** C major scale, first position: C3 to C4. */
export const C_MAJOR_FIRST_POSITION: SequencePosition[] = [
  [1, 3], [2, 0], [2, 2], [2, 3], [3, 0], [3, 2], [4, 0], [4, 1],
].map(([string, fret]) => ({ string, fret }));

/** E minor pentatonic, open position: E2 to G4. */
export const E_MINOR_PENTATONIC_OPEN: SequencePosition[] = [
  [0, 0], [0, 3], [1, 0], [1, 2], [2, 0], [2, 2], [3, 0], [3, 2], [4, 0], [4, 3], [5, 0], [5, 3],
].map(([string, fret]) => ({ string, fret }));
