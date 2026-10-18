"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hand, Play } from "lucide-react";
import type { Exercise } from "@/content/types";
import { Button, cn } from "@/components/ui";
import { ensureAudio, getAudioContext, scheduleClick } from "@/lib/audio/engine";
import { scoreTiming } from "@/lib/audio/scheduler";
import { ResultPanel, type ExerciseProps } from "./common";
import type { ExerciseOutcome } from "../utils";

type E = Extract<Exercise, { type: "tap-rhythm" }>;

/** Expected hit times (ms from start) after a one-bar count-in. */
export function expectedHits(e: Pick<E, "pattern" | "bpm" | "beatsPerBar" | "bars">): number[] {
  const spb = 60000 / e.bpm;
  const out: number[] = [];
  for (let bar = 0; bar < e.bars; bar++) for (const p of e.pattern) out.push((e.beatsPerBar + bar * e.beatsPerBar + p) * spb);
  return out;
}

export function TapRhythmExercise({ exercise, onComplete, onActivity, passAccuracy }: ExerciseProps<E> & { passAccuracy?: number }) {
  const [phase, setPhase] = useState<"idle" | "countin" | "play" | "done">("idle");
  const [beat, setBeat] = useState(-1);
  const [taps, setTaps] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null);
  const [result, setResult] = useState<ReturnType<typeof scoreTiming> | null>(null);
  const t0 = useRef(0);
  const raf = useRef(0);
  const tapsRef = useRef<number[]>([]);
  const phaseRef = useRef(phase);
  const spb = 60 / exercise.bpm;
  const totalBeats = exercise.beatsPerBar * (exercise.bars + 1);
  const windowMs = Math.min(250, spb * 1000 * 0.4);

  const finish = useCallback(() => {
    const exp = expectedHits(exercise);
    const r = scoreTiming(exp, tapsRef.current, windowMs);
    setResult(r);
    phaseRef.current = "done";
    setPhase("done");
    const o: ExerciseOutcome = {
      accuracy: Math.min(1, r.accuracy),
      correct: r.hitCount,
      total: exp.length,
      input: "tap",
      measured: true,
      details: `${r.hitCount}/${exp.length} on time${r.meanAbsMs !== null ? `, average ${Math.round(r.meanAbsMs)} ms off` : ""}${r.early ? `, ${r.early} early` : ""}${r.late ? `, ${r.late} late` : ""}${r.extra ? `, ${r.extra} extra tap${r.extra > 1 ? "s" : ""}` : ""}.`,
    };
    setOutcome(o);
    onComplete(o);
  }, [exercise, onComplete, windowMs]);

  const start = async () => {
    await ensureAudio();
    const ctx = getAudioContext();
    if (!ctx) return;
    onActivity?.();
    tapsRef.current = [];
    setTaps([]);
    setOutcome(null);
    setResult(null);
    const start = ctx.currentTime + 0.25;
    t0.current = start;
    for (let b = 0; b < totalBeats; b++) scheduleClick(ctx, start + b * spb, b % exercise.beatsPerBar === 0);
    phaseRef.current = "countin";
    setPhase("countin");
    const loop = () => {
      const now = ctx.currentTime - start;
      const b = Math.floor(now / spb);
      setBeat(b);
      if (b >= exercise.beatsPerBar && phaseRef.current === "countin") {
        phaseRef.current = "play";
        setPhase("play");
      }
      if (now > totalBeats * spb + windowMs / 1000) {
        finish();
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  const tap = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx || (phaseRef.current !== "play" && phaseRef.current !== "countin")) return;
    const ms = (ctx.currentTime - t0.current) * 1000;
    // Ignore taps well before the first expected beat (during count-in).
    if (ms < exercise.beatsPerBar * spb * 1000 - windowMs) return;
    tapsRef.current = [...tapsRef.current, ms];
    setTaps(tapsRef.current);
  }, [exercise.beatsPerBar, spb, windowMs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && (phaseRef.current === "play" || phaseRef.current === "countin")) {
        e.preventDefault();
        if (!e.repeat) tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf.current);
    };
  }, [tap]);

  const beatInBar = beat >= 0 ? beat % exercise.beatsPerBar : -1;
  const running = phase === "countin" || phase === "play";

  return (
    <div className="space-y-4">
      <p className="font-medium">{exercise.prompt}</p>
      <p className="text-sm text-muted">
        {exercise.bpm} BPM · {exercise.beatsPerBar}/4 · {exercise.bars} bar{exercise.bars > 1 ? "s" : ""} after a one-bar count-in. Tap the pad, press <kbd className="rounded bg-surface-2 px-1">Space</kbd>.
      </p>
      <div className="flex items-center gap-2" aria-hidden>
        {Array.from({ length: exercise.beatsPerBar }, (_, i) => (
          <span key={i} className={cn("h-4 w-4 rounded-full transition-colors", running && beatInBar === i ? (i === 0 ? "bg-accent" : "bg-text") : "bg-surface-3")} />
        ))}
        <span className="ml-2 text-sm font-medium" aria-live="polite">
          {phase === "countin" ? "Count-in… get ready" : phase === "play" ? "Tap now!" : ""}
        </span>
      </div>
      {phase === "idle" || phase === "done" ? (
        <Button onClick={() => void start()} data-testid="rhythm-start">
          <Play className="h-4 w-4" /> {phase === "done" ? "Go again" : "Start"}
        </Button>
      ) : (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
          className={cn("flex h-32 w-full select-none items-center justify-center gap-2 rounded-2xl border-2 text-lg font-semibold transition-colors", phase === "play" ? "border-accent bg-accent-soft text-accent active:bg-accent active:text-accent-fg" : "border-border bg-surface-2 text-muted")}
          aria-label="Tap pad"
          data-testid="tap-pad"
        >
          <Hand className="h-6 w-6" /> TAP ({taps.length})
        </button>
      )}
      {result && (
        <div className="flex flex-wrap gap-1.5" aria-label="Timing of each beat">
          {result.hits.map((h, i) => (
            <span key={i} className={cn("rounded-md px-2 py-1 text-xs tabular-nums", h.offsetMs === null ? "bg-danger-soft text-danger" : Math.abs(h.offsetMs) <= 40 ? "bg-success-soft text-success" : "bg-warn-soft text-warn")}>
              {h.offsetMs === null ? "missed" : `${h.offsetMs > 0 ? "+" : ""}${Math.round(h.offsetMs)} ms`}
            </span>
          ))}
        </div>
      )}
      {outcome && (
        <ResultPanel
          outcome={outcome}
          onRetry={() => void start()}
          passAccuracy={passAccuracy}
          extra={
            <p>
              {outcome.details} Negative = early, positive = late. Touchscreens and Bluetooth add a little delay, so treat a few tens of milliseconds as noise.
            </p>
          }
        />
      )}
    </div>
  );
}
