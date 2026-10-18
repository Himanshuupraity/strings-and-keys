"use client";

import { useRef, useState } from "react";
import { Keyboard } from "lucide-react";
import type { Exercise } from "@/content/types";
import { PianoKeyboard } from "@/components/instruments/piano-keyboard";
import { Fretboard } from "@/components/instruments/fretboard";
import { MicButton } from "@/components/instruments/mic-button";
import { Button, Callout, cn } from "@/components/ui";
import { useMic } from "@/hooks/use-mic";
import { usePrefs } from "@/hooks/use-prefs";
import { midiToName, mod12, nameToMidi } from "@/lib/music/notes";
import { playNote } from "@/lib/audio/engine";
import { Feedback, ResultPanel, type ExerciseProps } from "./common";
import { keyboardRange, type ExerciseOutcome } from "../utils";
import { preferredPosition } from "./play-sequence";

type E = Extract<Exercise, { type: "mic-note" }>;

/** In-tune tolerance in cents for counting a note as correct. */
const TOLERANCE = 20;

export function describePitch(detected: number, cents: number, target: number): string {
  if (detected === target) {
    if (Math.abs(cents) <= TOLERANCE) return "In tune!";
    return cents > 0 ? `Right note, but ${Math.round(cents)} cents sharp (too high) — loosen slightly or retune.` : `Right note, but ${Math.round(-cents)} cents flat (too low) — tighten slightly or retune.`;
  }
  const diff = detected - target;
  if (mod12(diff) === 0) return `That's ${midiToName(detected)} — the right note name, but ${Math.abs(diff / 12)} octave${Math.abs(diff) > 12 ? "s" : ""} ${diff > 0 ? "higher" : "lower"}.`;
  return `That's ${midiToName(detected)}, ${Math.abs(diff)} semitone${Math.abs(diff) > 1 ? "s" : ""} ${diff > 0 ? "higher" : "lower"} than ${midiToName(target)}. Check you're on the right string/key${Math.abs(diff) <= 2 ? ", or retune" : ""}.`;
}

export function MicNoteExercise({ exercise, instrument, onComplete, onActivity, track, passAccuracy }: ExerciseProps<E> & { passAccuracy?: number }) {
  const [prefs] = usePrefs();
  const target = nameToMidi(exercise.note);
  const inst = exercise.instrument ?? instrument;
  const [message, setMessage] = useState<{ kind: "correct" | "wrong" | "info"; text: string } | null>(null);
  const [wrong, setWrong] = useState(0);
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null);
  const [virtual, setVirtual] = useState(false);
  const goodFrames = useRef(0);
  const lastReported = useRef<number | null>(null);
  const doneRef = useRef(false);
  const lastText = useRef("");
  const say = (m: { kind: "correct" | "wrong" | "info"; text: string } | null) => {
    if ((m?.text ?? "") === lastText.current) return;
    lastText.current = m?.text ?? "";
    setMessage(m);
  };

  const finish = (input: "mic" | "virtual", details: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const o: ExerciseOutcome = { accuracy: Math.max(0.5, 1 - wrong * 0.15), correct: 1, total: 1, input, measured: true, details };
    setOutcome(o);
    onComplete(o);
  };

  const mic = useMic({
    a4: prefs.a4,
    mode: "pitch",
    onPitch: (f) => {
      if (doneRef.current || !f.note || !f.stable) {
        if (!f.note && f.level > 0.03 && !doneRef.current) say({ kind: "info", text: "We hear sound but can't find one clear pitch. Play a single note and let it ring — mute other strings." });
        return;
      }
      const { midi, cents } = f.note;
      // Theory lessons accept any octave (e.g. humming); instrument lessons need the exact pitch.
      const octaveOk = track === "theory" && mod12(midi) === mod12(target);
      const hit = (midi === target || octaveOk) && Math.abs(cents) <= TOLERANCE;
      if (hit) {
        goodFrames.current++;
        say({ kind: "correct", text: `${midiToName(midi)} · ${cents > 0 ? "+" : ""}${Math.round(cents)} cents — hold it…` });
        if (goodFrames.current >= 8) {
          finish("mic", `Heard ${midiToName(midi)} at ${cents > 0 ? "+" : ""}${Math.round(cents)} cents.`);
          mic.stop();
        }
      } else {
        goodFrames.current = 0;
        say({ kind: "wrong", text: describePitch(midi, cents, target) });
        if (lastReported.current !== midi) {
          lastReported.current = midi;
          if (midi !== target) setWrong((w) => w + 1);
        }
      }
    },
  });


  const onVirtual = (m: number) => {
    onActivity?.();
    if (doneRef.current) return;
    if (m === target) {
      setMessage({ kind: "correct", text: `${midiToName(m)} — correct!` });
      finish("virtual", "Played on the virtual instrument (pitch is exact, so tuning isn't tested).");
    } else {
      setWrong((w) => w + 1);
      setMessage({ kind: "wrong", text: describePitch(m, 0, target) });
    }
  };

  const reset = () => {
    doneRef.current = false;
    goodFrames.current = 0;
    lastReported.current = null;
    setWrong(0);
    setOutcome(null);
    say(null);
  };

  const range = keyboardRange([target]);
  const pos = preferredPosition(target);

  return (
    <div className="space-y-4">
      <p className="font-medium">{exercise.prompt}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-2xl border border-border bg-surface-2 px-5 py-3 text-center">
          <p className="text-xs uppercase tracking-wide text-subtle">Target</p>
          <p className="text-3xl font-semibold">{midiToName(target)}</p>
          <p className="text-xs text-muted">{(prefs.a4 * Math.pow(2, (target - 69) / 12)).toFixed(1)} Hz</p>
        </div>
        <Button variant="secondary" onClick={() => void playNote(inst, target, 0, 1.5)}>
          Play the target
        </Button>
      </div>
      {!outcome && <MicButton status={mic.status} error={mic.error} onStart={() => { onActivity?.(); void mic.start(); }} onStop={mic.stop} />}
      {mic.listening && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">Hearing:</span>
          <span className="text-2xl font-semibold tabular-nums">{mic.pitch?.note ? midiToName(mic.pitch.note.midi) : "—"}</span>
          {mic.pitch?.note && <span className={cn("tabular-nums", Math.abs(mic.pitch.note.cents) <= TOLERANCE ? "text-success" : "text-warn")}>{mic.pitch.note.cents > 0 ? "+" : ""}{Math.round(mic.pitch.note.cents)}¢</span>}
          <span className="h-2 w-24 overflow-hidden rounded-full bg-surface-3" aria-label="Input level">
            <span className="block h-full bg-accent" style={{ width: `${Math.min(100, (mic.pitch?.level ?? 0) * 600)}%` }} />
          </span>
        </div>
      )}
      <Feedback kind={message?.kind ?? null}>{message?.text}</Feedback>
      {mic.listening && <p className="text-xs text-muted">Measured: pitch only. The microphone can&apos;t tell which finger or string you used.</p>}
      {outcome ? (
        <ResultPanel outcome={outcome} onRetry={reset} passAccuracy={passAccuracy} extra={<p>{outcome.details}</p>} />
      ) : virtual || mic.status === "error" ? (
        <div className="space-y-2">
          <Callout tone="neutral" title="Using the virtual instrument instead">This checks the note, not your real instrument&apos;s tuning.</Callout>
          {inst === "piano" ? <PianoKeyboard low={range.low} high={range.high} onNoteOn={onVirtual} labels="white" focusMidi={target} /> : <Fretboard frets={12} onPlay={(p) => onVirtual(p.midi)} marks={pos ? [{ string: pos.string, fret: pos.fret, tone: "hint" }] : []} />}
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setVirtual(true)}>
          <Keyboard className="h-4 w-4" /> No microphone? Use the virtual {inst}
        </Button>
      )}
    </div>
  );
}
