"use client";
import { useT, useTx } from "@/lib/i18n";

import { useMemo, useState } from "react";
import type { Exercise } from "@/content/types";
import { PianoKeyboard } from "@/components/instruments/piano-keyboard";
import { Fretboard } from "@/components/instruments/fretboard";
import { Staff } from "@/components/instruments/staff";
import { Button, cn } from "@/components/ui";
import { positionsOfMidi } from "@/lib/music/guitar";
import { isBlackKey, midiToName, NATURAL_LETTERS, pcDualName } from "@/lib/music/notes";
import { playNote } from "@/lib/audio/engine";
import { Feedback, HintButton, ResultPanel, type ExerciseProps } from "./common";
import { keyboardRange, toMidi, type ExerciseOutcome } from "../utils";

type E = Extract<Exercise, { type: "name-note" }>;

const HINTS: Record<E["on"], string> = {
  "staff-treble": "Treble lines from the bottom: E G B D F (Every Good Boy Does Fine). Spaces: F A C E.",
  "staff-bass": "Bass lines from the bottom: G B D F A (Good Boys Do Fine Always). Spaces: A C E G.",
  keyboard: "Find the nearest group of two black keys: the white key just left of it is C. Count up from there.",
  fretboard: "Start from the open string's name and count up one letter-step per two frets (only one fret between E–F and B–C).",
};

export function NameNoteExercise({ exercise, instrument, onComplete, onActivity, passAccuracy }: ExerciseProps<E> & { passAccuracy?: number }) {
  const tr = useT();
  const tx = useTx();
  const notes = useMemo(() => exercise.notes.map(toMidi), [exercise.notes]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null);
  const midi = notes[i];
  const answer = isBlackKey(midi) ? pcDualName(midi) : midiToName(midi).replace(/-?\d+$/, "");
  const options = useMemo(() => {
    const base: string[] = [...NATURAL_LETTERS];
    return isBlackKey(midi) ? [...base, answer] : base;
  }, [midi, answer]);
  const range = keyboardRange(notes);

  const choose = (o: string) => {
    if (picked) return;
    onActivity?.();
    setPicked(o);
    void playNote(instrument, midi);
    const ns = score + (o === answer ? 1 : 0);
    setScore(ns);
    if (i === notes.length - 1) {
      const out: ExerciseOutcome = { accuracy: ns / notes.length, correct: ns, total: notes.length, input: "virtual", measured: true, details: tr("ui.note_naming") };
      setOutcome(out);
      onComplete(out);
    }
  };
  const reset = () => {
    setI(0);
    setPicked(null);
    setScore(0);
    setOutcome(null);
  };

  const pos = positionsOfMidi(midi, 12).sort((a, b) => a.fret - b.fret)[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{exercise.prompt}</p>
        <span className="text-sm tabular-nums text-muted">
          {i + 1}/{notes.length} · {score} correct
        </span>
      </div>
      {exercise.on === "keyboard" && <PianoKeyboard low={range.low} high={range.high} labels="none" highlight={{ [midi]: "target" }} playSound focusMidi={midi} />}
      {exercise.on === "staff-treble" && <Staff clef="treble" notes={[{ note: midiToName(midi), duration: "w" }]} highlightIndex={0} />}
      {exercise.on === "staff-bass" && <Staff clef="bass" notes={[{ note: midiToName(midi), duration: "w" }]} highlightIndex={0} />}
      {exercise.on === "fretboard" && pos && <Fretboard frets={12} marks={[{ string: pos.string, fret: pos.fret, tone: "target", label: "?" }]} />}
      <div className="flex flex-wrap gap-2" role="group" aria-label={tr("ui.note_names")}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => choose(o)}
            disabled={!!picked}
            className={cn(
              "min-h-11 min-w-11 rounded-xl border px-3 text-sm font-semibold transition-colors",
              picked && o === answer ? "border-success bg-success-soft text-success" : picked === o ? "border-danger bg-danger-soft text-danger" : "border-border bg-surface hover:border-accent hover:bg-accent-soft",
            )}
          >
            {o}
          </button>
        ))}
      </div>
      <Feedback kind={picked ? (picked === answer ? "correct" : "wrong") : null}>{picked ? (picked === answer ? `Yes — ${midiToName(midi)}.` : `It's ${answer} (${midiToName(midi)}).`) : null}</Feedback>
      {picked && i < notes.length - 1 && (
        <Button
          onClick={() => {
            setI(i + 1);
            setPicked(null);
          }}
        >
          {tr("ui.next_note")}
        </Button>
      )}
      {outcome ? <ResultPanel outcome={outcome} onRetry={reset} passAccuracy={passAccuracy} /> : <HintButton hint={tx(HINTS[exercise.on])} />}
    </div>
  );
}
