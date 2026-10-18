"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Exercise } from "@/content/types";
import { PianoKeyboard, type KeyTone } from "@/components/instruments/piano-keyboard";
import { Fretboard, type FretMark } from "@/components/instruments/fretboard";
import { NoteText } from "@/components/instruments/note-label";
import { Switch, cn } from "@/components/ui";
import { useNoteInput, type NoteSource } from "@/hooks/use-note-input";
import { positionsOfMidi, stringNumber } from "@/lib/music/guitar";
import { midiToName, isBlackKey } from "@/lib/music/notes";
import { mistakeSummary, sequenceAccuracy, startSequence, stepSequence, type SequenceState } from "@/lib/exercises/sequence";
import type { InputMethod } from "@/lib/storage/schemas";
import { Feedback, HintButton, InputSources, ResultPanel, type ExerciseProps } from "./common";
import { keyboardRange, toMidi, type ExerciseOutcome } from "../utils";

type E = Extract<Exercise, { type: "play-sequence" }>;

/** Preferred fret position for a pitch: the lowest fret (open strings first). */
export function preferredPosition(midi: number) {
  return positionsOfMidi(midi, 15).sort((a, b) => a.fret - b.fret || b.string - a.string)[0];
}

export function describeTarget(midi: number, instrument: "piano" | "guitar") {
  if (instrument === "guitar") {
    const p = preferredPosition(midi);
    if (!p) return `${midiToName(midi)}`;
    return `${midiToName(midi)} — string ${stringNumber(p.string)}, ${p.fret === 0 ? "open" : `fret ${p.fret}`}.`;
  }
  const name = midiToName(midi);
  if (midi === 60) return "Middle C — the white key just left of the two black keys in the middle (marked with a dot).";
  return `${name} — ${isBlackKey(midi) ? "a black key" : "a white key"}${midi < 60 ? " to the left of middle C" : midi > 60 ? " to the right of middle C" : ""}.`;
}

export function PlaySequenceExercise({ exercise, instrument, onComplete, onActivity, passAccuracy }: ExerciseProps<E> & { passAccuracy?: number }) {
  const targets = useMemo(() => exercise.notes.map(toMidi), [exercise.notes]);
  const [state, setState] = useState<SequenceState>(() => startSequence(targets, !!exercise.anyOctave));
  const [flash, setFlash] = useState<{ midi: number; kind: "correct" | "wrong"; source: NoteSource } | null>(null);
  const [showTargets, setShowTargets] = useState(true);
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null);
  const lastSource = useRef<InputMethod>("virtual");
  const stateRef = useRef(state);

  const handle = useCallback(
    (midi: number, source: NoteSource) => {
      onActivity?.();
      const cur = stateRef.current;
      if (cur.done) return;
      const r = stepSequence(cur, midi);
      lastSource.current = source;
      stateRef.current = r.state;
      setState(r.state);
      setFlash({ midi, kind: r.verdict === "correct" ? "correct" : "wrong", source });
      if (r.state.done) {
        const acc = sequenceAccuracy(r.state);
        const o: ExerciseOutcome = {
          accuracy: acc,
          correct: r.state.wrongBefore.filter((w) => w === 0).length,
          total: targets.length,
          input: source,
          measured: true,
          details: mistakeSummary(r.state, (m) => midiToName(m)) ?? undefined,
        };
        setOutcome(o);
        onComplete(o);
      }
    },
    [onActivity, onComplete, targets.length],
  );

  const input = useNoteInput((m, src) => handle(m, src));

  const reset = () => {
    const s = startSequence(targets, !!exercise.anyOctave);
    stateRef.current = s;
    setState(s);
    setOutcome(null);
    setFlash(null);
  };

  const current = state.done ? undefined : targets[state.index];
  const hint = current !== undefined ? `Next: ${describeTarget(current, instrument)}` : null;

  // Visual state
  const range = keyboardRange(targets);
  const highlight: Partial<Record<number, KeyTone>> = {};
  if (showTargets && current !== undefined) highlight[current] = "target";
  if (flash) highlight[flash.midi] = flash.kind;
  const fingers: Partial<Record<number, number>> = {};
  if (exercise.fingers && current !== undefined && exercise.fingers[state.index] > 0) fingers[current] = exercise.fingers[state.index];

  const marks: FretMark[] = [];
  if (showTargets && current !== undefined) {
    const p = preferredPosition(current);
    if (p) marks.push({ string: p.string, fret: p.fret, tone: "target", finger: exercise.fingers?.[state.index] || undefined });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">{exercise.prompt}</p>
        <Switch checked={showTargets} onChange={setShowTargets} label="Show target" />
      </div>
      <ol className="flex flex-wrap gap-1.5" aria-label="Notes to play">
        {targets.map((t, i) => (
          <li
            key={i}
            className={cn(
              "rounded-lg border px-2 py-1 text-sm tabular-nums",
              i < state.index ? (state.wrongBefore[i] ? "border-warn/50 bg-warn-soft text-warn" : "border-success/40 bg-success-soft text-success") : i === state.index && !state.done ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border text-muted",
            )}
          >
            <NoteText midi={t} />
          </li>
        ))}
      </ol>
      {instrument === "piano" ? (
        <PianoKeyboard low={range.low} high={range.high} highlight={highlight} fingers={fingers} onNoteOn={(m) => handle(m, "virtual")} computerKeyboard focusMidi={current ?? targets[0]} labels="white" />
      ) : (
        <Fretboard frets={12} marks={marks} onPlay={(p) => handle(p.midi, "virtual")} />
      )}
      <Feedback kind={flash?.kind ?? null}>
        {flash && (flash.kind === "correct" ? `${midiToName(flash.midi)} — correct!` : `You played ${midiToName(flash.midi)}${flash.source === "mic" ? " (heard by the mic)" : ""}. ${current !== undefined ? (exercise.anyOctave ? `We're looking for ${midiToName(current).replace(/-?\d+$/, "")}.` : flash.midi < current ? "That's lower than the target — go higher." : "That's higher than the target — go lower.") : ""}`)}
      </Feedback>
      {outcome ? <ResultPanel outcome={outcome} onRetry={reset} passAccuracy={passAccuracy} extra={outcome.details ? <p>{outcome.details}</p> : null} /> : <HintButton hint={hint} />}
      <InputSources input={input} />
    </div>
  );
}
