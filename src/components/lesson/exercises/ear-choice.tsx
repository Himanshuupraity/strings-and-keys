"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { Exercise } from "@/content/types";
import { Button, cn } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { chordMidi } from "@/lib/music/chords";
import { pcName, pitchClassOf } from "@/lib/music/notes";
import { referenceSaMidi, SWARAS } from "@/lib/music/sargam";
import { intervalName } from "@/lib/music/scales";
import { playNote, playPianoChord } from "@/lib/audio/engine";
import { Feedback, ResultPanel, type ExerciseProps } from "./common";
import type { ExerciseOutcome, Inst } from "../utils";

type E = Extract<Exercise, { type: "ear-choice" }>;

interface Round {
  /** Notes to play one after another, or a chord. */
  play: { kind: "seq"; notes: number[] } | { kind: "chord"; notes: number[] };
  answer: string;
  options: string[];
}

const DEFAULT_INTERVALS = ["Minor 2nd", "Major 2nd", "Minor 3rd", "Major 3rd", "Perfect 4th", "Perfect 5th", "Octave"];
const rand = (n: number) => Math.floor(Math.random() * n);

/** Generates rounds (called on Start, never during render, so SSR/hydration stays deterministic). */
export function makeRounds(e: E, tonicPc: number): Round[] {
  return Array.from({ length: e.rounds }, (_, i): Round => {
    switch (e.mode) {
      case "high-low": {
        const a = 55 + rand(18);
        // Later rounds get closer together.
        const maxGap = Math.max(1, 7 - i);
        const gap = 1 + rand(maxGap);
        const up = Math.random() < 0.5;
        return { play: { kind: "seq", notes: [a, up ? a + gap : a - gap] }, answer: up ? "Higher" : "Lower", options: ["Higher", "Lower"] };
      }
      case "interval": {
        const options = e.options?.length ? e.options : DEFAULT_INTERVALS;
        const name = options[rand(options.length)];
        const semis = Array.from({ length: 13 }, (_, s) => s).find((s) => intervalName(s) === name) ?? 2;
        const root = 57 + rand(8);
        return { play: { kind: "seq", notes: [root, root + semis] }, answer: name, options };
      }
      case "major-minor": {
        const root = ["C", "D", "E", "F", "G", "A"][rand(6)];
        const minor = Math.random() < 0.5;
        return { play: { kind: "chord", notes: chordMidi(root + (minor ? "m" : ""), 4) }, answer: minor ? "Minor" : "Major", options: ["Major", "Minor"] };
      }
      case "note-name": {
        const options = e.options?.length ? e.options : ["C", "D", "E", "F", "G", "A", "B"];
        const name = options[rand(options.length)];
        const pc = pitchClassOf(name);
        return { play: { kind: "seq", notes: [60, 60 + pc] }, answer: name, options };
      }
      case "swara": {
        const options = e.options?.length ? e.options : ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"];
        const name = options[rand(options.length)];
        const sw = SWARAS.find((s) => s.full === name) ?? SWARAS[0];
        const sa = referenceSaMidi(tonicPc);
        return { play: { kind: "seq", notes: [sa, sa + sw.degree] }, answer: name, options };
      }
    }
  });
}

async function playRound(r: Round, instrument: Inst) {
  if (r.play.kind === "chord") {
    await playPianoChord(r.play.notes, 1.2);
    r.play.notes.forEach((n, k) => void playNote("piano", n, 1.4 + k * 0.3, 0.4));
    return;
  }
  const [a, b] = r.play.notes;
  await playNote(instrument, a, 0, 0.7);
  await playNote(instrument, b, 0.9, 0.7);
}

export function EarChoiceExercise({ exercise, instrument, onComplete, onActivity, passAccuracy }: ExerciseProps<E> & { passAccuracy?: number }) {
  const [prefs] = usePrefs();
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null);

  const start = () => {
    const r = makeRounds(exercise, prefs.tonicPc);
    setRounds(r);
    setI(0);
    setScore(0);
    setPicked(null);
    setOutcome(null);
    void playRound(r[0], instrument);
    onActivity?.();
  };

  if (!rounds) {
    return (
      <div className="space-y-3">
        <p className="font-medium">{exercise.prompt}</p>
        {exercise.mode === "swara" && <p className="text-sm text-muted">Your Sa is {pcName(prefs.tonicPc, prefs.spelling)} (change it in Settings).</p>}
        <Button onClick={start} data-testid="ear-start">
          <Play className="h-4 w-4" /> Start ({exercise.rounds} rounds)
        </Button>
      </div>
    );
  }

  const round = rounds[i];
  const choose = (opt: string) => {
    if (picked) return;
    onActivity?.();
    setPicked(opt);
    const ns = score + (opt === round.answer ? 1 : 0);
    setScore(ns);
    if (i === rounds.length - 1) {
      const o: ExerciseOutcome = { accuracy: ns / rounds.length, correct: ns, total: rounds.length, input: "virtual", measured: true, details: `Ear training (${exercise.mode})` };
      setOutcome(o);
      onComplete(o);
    }
  };
  const next = () => {
    const n = i + 1;
    setI(n);
    setPicked(null);
    void playRound(rounds[n], instrument);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{exercise.prompt}</p>
        <span className="text-sm tabular-nums text-muted">
          Round {i + 1}/{rounds.length} · {score} correct
        </span>
      </div>
      <Button variant="secondary" onClick={() => void playRound(round, instrument)}>
        <Play className="h-4 w-4" /> Replay
      </Button>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Answers">
        {round.options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => choose(o)}
            disabled={!!picked}
            className={cn(
              "min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors",
              picked && o === round.answer ? "border-success bg-success-soft text-success" : picked === o ? "border-danger bg-danger-soft text-danger" : "border-border bg-surface hover:border-accent hover:bg-accent-soft",
            )}
          >
            {o}
          </button>
        ))}
      </div>
      <Feedback kind={picked ? (picked === round.answer ? "correct" : "wrong") : null}>{picked ? (picked === round.answer ? "Correct!" : `It was ${round.answer}. Replay it to hear the difference.`) : null}</Feedback>
      {picked && i < rounds.length - 1 && <Button onClick={next}>Next round</Button>}
      {outcome && <ResultPanel outcome={outcome} onRetry={start} passAccuracy={passAccuracy} />}
    </div>
  );
}
