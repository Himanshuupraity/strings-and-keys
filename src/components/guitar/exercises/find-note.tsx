"use client";

import { useState } from "react";
import { Fretboard, type FretMark } from "@/components/instruments/fretboard";
import { cn } from "@/components/ui";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { mod12, pcName } from "@/lib/music/notes";
import { positionsOfPitchClass } from "@/lib/music/guitar";
import { ResultSummary, saveGuitarResult } from "./shared";

const ROUNDS = 8;
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
const pick = (prev?: number) => {
  const opts = NATURALS.filter((n) => n !== prev);
  return opts[Math.floor(Math.random() * opts.length)];
};

/** Find any position of a note on frets 0–12. First click counts. */
export function FindNote() {
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(() => pick());
  const [correct, setCorrect] = useState(0);
  const [marks, setMarks] = useState<FretMark[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { ping } = usePracticeLog("Guitar exercise: find notes", { instrument: "guitar" });

  const onPlay = ({ string, fret, midi }: { string: number; fret: number; midi: number }) => {
    if (busy || round >= ROUNDS) return;
    ping();
    const ok = mod12(midi) === target;
    setBusy(true);
    const all = positionsOfPitchClass(target, 12).map((p) => ({ string: p.string, fret: p.fret, tone: "hint" as const }));
    setMarks([...(ok ? [] : all), { string, fret, tone: ok ? "correct" : "wrong" }]);
    setMsg({ ok, text: ok ? `Correct — that's ${pcName(target)}.` : `That was ${pcName(midi)}. Every ${pcName(target)} is now shown in grey.` });
    const nc = correct + (ok ? 1 : 0);
    setCorrect(nc);
    setTimeout(() => {
      const next = round + 1;
      setRound(next);
      setMarks([]);
      setMsg(null);
      setBusy(false);
      setTarget((t) => pick(t));
      if (next >= ROUNDS) void saveGuitarResult({ exerciseId: "guitar-find-note", skill: "fretboard-notes", input: "virtual", correct: nc, total: ROUNDS, measured: true });
    }, ok ? 900 : 2200);
  };

  if (round >= ROUNDS)
    return (
      <ResultSummary title="Find the note" correct={correct} total={ROUNDS} source="measured" onRetry={() => { setRound(0); setCorrect(0); }}>
        Tip: learn the notes on the low E and A strings first — they are the roots of most chords.
      </ResultSummary>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Round {round + 1} of {ROUNDS}: tap <strong>any</strong> position of the note <strong className="text-2xl text-accent">{pcName(target)}</strong> (frets 0–12).
      </p>
      <Fretboard frets={12} marks={marks} onPlay={onPlay} />
      {msg && <p className={cn("text-sm font-medium", msg.ok ? "text-success" : "text-danger")} role="status">{msg.text}</p>}
    </div>
  );
}
