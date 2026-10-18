"use client";
import { useT } from "@/lib/i18n";

import { useMemo, useState } from "react";
import type { Exercise } from "@/content/types";
import { PianoKeyboard, type KeyTone } from "@/components/instruments/piano-keyboard";
import { Fretboard, type FretMark } from "@/components/instruments/fretboard";
import { positionsOfPitchClass } from "@/lib/music/guitar";
import { mod12, pcDualName } from "@/lib/music/notes";
import { Feedback, HintButton, ResultPanel, type ExerciseProps } from "./common";
import type { ExerciseOutcome } from "../utils";

type E = Extract<Exercise, { type: "find-all" }>;

const PIANO_LOW = 48;
const PIANO_HIGH = 84;
const GUITAR_FRETS = 12;

export function FindAllExercise({ exercise, instrument, onComplete, onActivity, passAccuracy }: ExerciseProps<E> & { passAccuracy?: number }) {
  const tr = useT();
  const inst = exercise.instrument ?? instrument;
  const pc = mod12(exercise.pitchClass);
  // Targets keyed by position so the same pitch on two strings counts twice.
  const targets = useMemo(
    () =>
      inst === "piano"
        ? Array.from({ length: PIANO_HIGH - PIANO_LOW + 1 }, (_, i) => PIANO_LOW + i).filter((m) => mod12(m) === pc).map((m) => `k${m}`)
        : positionsOfPitchClass(pc, GUITAR_FRETS).map((p) => `${p.string}:${p.fret}`),
    [inst, pc],
  );
  const [found, setFound] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [last, setLast] = useState<"correct" | "wrong" | null>(null);
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null);

  const click = (key: string, isTarget: boolean) => {
    onActivity?.();
    if (outcome) return;
    if (isTarget) {
      if (found.includes(key)) return;
      const nf = [...found, key];
      setFound(nf);
      setLast("correct");
      if (nf.length === targets.length) {
        const acc = Math.max(0, (targets.length - wrong.length * 0.5) / targets.length);
        const o: ExerciseOutcome = { accuracy: acc, correct: targets.length, total: targets.length, input: "virtual", measured: true, details: wrong.length ? `${wrong.length} wrong click${wrong.length > 1 ? "s" : ""}.` : "No wrong clicks!" };
        setOutcome(o);
        onComplete(o);
      }
    } else {
      setWrong((w) => [...w, key]);
      setLast("wrong");
    }
  };

  const reset = () => {
    setFound([]);
    setWrong([]);
    setLast(null);
    setOutcome(null);
  };

  const name = pcDualName(pc);
  const hint =
    inst === "piano"
      ? pc === 0
        ? tr("ui.c_is_the_white_key_just_to_the_left_of_each_grou")
        : pc === 6
          ? tr("ui.f_is_the_first_black_key_in_each_group_of_three")
          : tr("ui.every_x_12_keys", { name })
      : tr("ui.each_string_12_frets", { name });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{exercise.prompt}</p>
        <span className="text-sm tabular-nums text-muted">
          Found {found.length} / {targets.length}
        </span>
      </div>
      {inst === "piano" ? (
        <PianoKeyboard
          low={PIANO_LOW}
          high={PIANO_HIGH}
          labels="none"
          whiteKeyWidth={36}
          highlight={Object.fromEntries([...found.map((k) => [Number(k.slice(1)), "correct" as KeyTone]), ...(last === "wrong" && wrong.length ? [[Number(wrong[wrong.length - 1].slice(1)), "wrong" as KeyTone]] : [])])}
          onNoteOn={(m) => click(`k${m}`, mod12(m) === pc)}
        />
      ) : (
        <Fretboard
          frets={GUITAR_FRETS}
          marks={[
            ...found.map((k): FretMark => ({ string: Number(k.split(":")[0]), fret: Number(k.split(":")[1]), tone: "correct" })),
            ...(last === "wrong" && wrong.length ? [{ string: Number(wrong[wrong.length - 1].split(":")[0]), fret: Number(wrong[wrong.length - 1].split(":")[1]), tone: "wrong" as const }] : []),
          ]}
          onPlay={(p) => click(`${p.string}:${p.fret}`, mod12(p.midi) === pc)}
        />
      )}
      <Feedback kind={last}>{last === "correct" ? `Yes, that's ${name}!` : last === "wrong" ? `Not ${name} — try another.` : null}</Feedback>
      {outcome ? <ResultPanel outcome={outcome} onRetry={reset} passAccuracy={passAccuracy} extra={<p>{outcome.details}</p>} /> : <HintButton hint={hint} />}
    </div>
  );
}
