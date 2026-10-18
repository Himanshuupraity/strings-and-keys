"use client";

import { useState } from "react";
import { Fretboard } from "@/components/instruments/fretboard";
import { Button, cn } from "@/components/ui";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { playGuitarNote } from "@/lib/audio/engine";
import { STANDARD_TUNING, stringNumber } from "@/lib/music/guitar";
import { pcName } from "@/lib/music/notes";
import { ResultSummary, saveGuitarResult } from "./shared";

const ROUNDS = 8;
const OPTIONS = ["E", "A", "D", "G", "B"];

function randomString(prev?: number) {
  let s = Math.floor(Math.random() * 6);
  if (s === prev) s = (s + 1 + Math.floor(Math.random() * 5)) % 6;
  return s;
}

export function OpenStringsQuiz() {
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(() => randomString());
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const { ping } = usePracticeLog("Guitar exercise: open strings", { instrument: "guitar" });
  const done = round >= ROUNDS;
  const answer = pcName(STANDARD_TUNING[target]);

  const choose = (opt: string) => {
    if (locked) return;
    ping();
    const ok = opt === answer;
    void playGuitarNote(STANDARD_TUNING[target]);
    setLocked(true);
    const nextCorrect = correct + (ok ? 1 : 0);
    setCorrect(nextCorrect);
    setFeedback({ ok, text: ok ? `Yes! String ${stringNumber(target)} is ${answer}.` : `Not quite — string ${stringNumber(target)} is ${answer}${target === 0 ? " (low E)" : target === 5 ? " (high E)" : ""}.` });
    setTimeout(() => {
      const next = round + 1;
      setRound(next);
      setLocked(false);
      setFeedback(null);
      setTarget((t) => randomString(t));
      if (next >= ROUNDS) void saveGuitarResult({ exerciseId: "guitar-open-strings", skill: "open-strings", input: "virtual", correct: nextCorrect, total: ROUNDS, measured: true });
    }, 1200);
  };

  const reset = () => {
    setRound(0);
    setCorrect(0);
    setTarget(randomString());
  };

  if (done)
    return (
      <ResultSummary title="Open strings quiz" correct={correct} total={ROUNDS} source="measured" onRetry={reset}>
        Low to high: E A D G B E. Say it out loud while you pluck each string on your guitar.
      </ResultSummary>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Round {round + 1} of {ROUNDS}: what is the name of the <strong className="text-accent">highlighted string</strong> (string {stringNumber(target)})?
      </p>
      <Fretboard frets={5} activeString={target} playSound={false} marks={[{ string: target, fret: 0, tone: "target", label: "?" }]} ariaLabel="Fretboard with one string highlighted" />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Answer choices">
        {OPTIONS.map((o) => (
          <Button key={o} variant="secondary" size="lg" className="w-16" onClick={() => choose(o)} disabled={locked}>
            {o}
          </Button>
        ))}
      </div>
      {feedback && <p className={cn("text-sm font-medium", feedback.ok ? "text-success" : "text-danger")} role="status">{feedback.text}</p>}
    </div>
  );
}
