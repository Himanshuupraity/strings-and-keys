"use client";

import { useMemo, useRef, useState } from "react";
import { Music } from "lucide-react";
import type { Exercise } from "@/content/types";
import { PianoKeyboard, type KeyTone } from "@/components/instruments/piano-keyboard";
import { Fretboard, type FretMark } from "@/components/instruments/fretboard";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { Badge, Button, Callout, ProgressBar } from "@/components/ui";
import { MicButton } from "@/components/instruments/mic-button";
import { useMidi } from "@/hooks/use-midi";
import { useMic } from "@/hooks/use-mic";
import { usePrefs } from "@/hooks/use-prefs";
import { chordMidi, chordNoteNames, chordPitchClasses, compareChordTones, easiestShape } from "@/lib/music/chords";
import { STANDARD_TUNING } from "@/lib/music/guitar";
import { mod12 } from "@/lib/music/notes";
import { playPianoChord, strum } from "@/lib/audio/engine";
import type { InputMethod } from "@/lib/storage/schemas";
import { Feedback, HintButton, ResultPanel, type ExerciseProps } from "./common";
import { keyboardRange, type ExerciseOutcome } from "../utils";

type E = Extract<Exercise, { type: "play-chord" }>;

/** Check a set of sounding notes against a chord: all tones present, nothing extra. */
export function judgeChord(chord: string, midis: number[], minNotes: number) {
  const r = compareChordTones(chord, midis.map(mod12));
  const ok = r.missing.length === 0 && r.unwanted.length === 0 && midis.length >= minNotes;
  return { ...r, ok };
}

export function PlayChordExercise({ exercise, instrument, onComplete, onActivity, passAccuracy }: ExerciseProps<E> & { passAccuracy?: number }) {
  const [prefs] = usePrefs();
  const tones = useMemo(() => chordPitchClasses(exercise.chord), [exercise.chord]);
  const minNotes = Math.min(3, tones.length);
  const names = chordNoteNames(exercise.chord);
  const [pianoSel, setPianoSel] = useState<number[]>([]);
  const [guitarSel, setGuitarSel] = useState<Record<number, number>>({});
  const [checks, setChecks] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof judgeChord> | null>(null);
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null);
  const done = useRef(false);

  const finish = (input: InputMethod, wrongChecks: number, details: string) => {
    if (done.current) return;
    done.current = true;
    const o: ExerciseOutcome = { accuracy: Math.max(0.5, Math.pow(0.8, wrongChecks)), correct: 1, total: 1, input, measured: true, details };
    setOutcome(o);
    onComplete(o);
  };

  const check = (midis: number[], input: InputMethod) => {
    onActivity?.();
    const r = judgeChord(exercise.chord, midis, minNotes);
    setResult(r);
    if (r.ok) finish(input, checks, checks ? `Correct after ${checks} wrong check${checks > 1 ? "s" : ""}.` : "Correct on the first check!");
    else setChecks((c) => c + 1);
  };

  // MIDI: check whenever the set of held keys changes.
  const heldRef = useRef(new Set<number>());
  const midi = useMidi((e) => {
    if (e.type === "on") heldRef.current.add(e.midi);
    else heldRef.current.delete(e.midi);
    if (done.current || heldRef.current.size < minNotes) return;
    const r = judgeChord(exercise.chord, [...heldRef.current], minNotes);
    if (r.ok) {
      setResult(r);
      finish("midi", checks, "Played on a MIDI keyboard.");
    }
  });

  // Microphone: chroma estimate (best effort). Accepted only after several consistent, confident frames.
  const stableFrames = useRef(0);
  const mic = useMic({
    a4: prefs.a4,
    mode: "chroma",
    onChroma: (c) => {
      if (done.current) return;
      const r = compareChordTones(exercise.chord, c.activePcs);
      const good = c.confidence >= 0.55 && r.missing.length === 0 && r.unwanted.length === 0;
      stableFrames.current = good ? stableFrames.current + 1 : 0;
      if (stableFrames.current >= 6) {
        finish("mic", checks, "Recognised by the microphone (chord estimate).");
        mic.stop();
      }
    },
  });
  const chroma = mic.chroma;

  const reset = () => {
    done.current = false;
    setPianoSel([]);
    setGuitarSel({});
    setChecks(0);
    setResult(null);
    setOutcome(null);
    stableFrames.current = 0;
  };

  const guitarMidis = Object.entries(guitarSel).map(([s, f]) => STANDARD_TUNING[Number(s)] + f);
  const shape = easiestShape(exercise.chord);
  const range = keyboardRange(chordMidi(exercise.chord, 4));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{exercise.prompt}</p>
        <Badge tone="theory">Chord tones: {names.join(" · ")}</Badge>
      </div>

      {instrument === "piano" ? (
        <>
          <p className="text-sm text-muted">Click keys to select them (click again to remove), then press <strong>Play & check</strong>. On a MIDI keyboard just hold the chord.</p>
          <PianoKeyboard
            low={range.low}
            high={range.high}
            labels="white"
            playSound
            highlight={Object.fromEntries([...pianoSel, ...midi.held].map((m) => [m, "chord" as KeyTone]))}
            onNoteOn={(m) => {
              onActivity?.();
              setPianoSel((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void playPianoChord(pianoSel, 1.2);
                check(pianoSel, "virtual");
              }}
              disabled={!pianoSel.length || !!outcome}
            >
              <Music className="h-4 w-4" /> Play & check
            </Button>
            <Button variant="ghost" onClick={() => setPianoSel([])} disabled={!pianoSel.length}>
              Clear
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">Click one fret per string (click an open string to ring it open). Strings you leave empty are muted. Then press <strong>Strum & check</strong>.</p>
          <Fretboard
            frets={7}
            playSound
            mutedStrings={[0, 1, 2, 3, 4, 5].filter((s) => guitarSel[s] === undefined)}
            marks={Object.entries(guitarSel).map(([s, f]): FretMark => ({ string: Number(s), fret: f, tone: result ? (tones.includes(mod12(STANDARD_TUNING[Number(s)] + f)) ? "correct" : "wrong") : "chord" }))}
            onPlay={(p) => {
              onActivity?.();
              setResult(null);
              setGuitarSel((g) => {
                const n = { ...g };
                if (n[p.string] === p.fret) delete n[p.string];
                else n[p.string] = p.fret;
                return n;
              });
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void strum(guitarMidis);
                check(guitarMidis, "virtual");
              }}
              disabled={!guitarMidis.length || !!outcome}
            >
              <Music className="h-4 w-4" /> Strum & check
            </Button>
            <Button variant="ghost" onClick={() => setGuitarSel({})} disabled={!guitarMidis.length}>
              Clear
            </Button>
          </div>
        </>
      )}

      {result && !result.ok && (
        <Feedback kind="wrong">
          {result.missing.length > 0 && `Missing: ${result.missing.map(result.name).join(", ")}. `}
          {result.unwanted.length > 0 && `Not in ${exercise.chord}: ${result.unwanted.map(result.name).join(", ")}. `}
          {result.missing.length === 0 && result.unwanted.length === 0 && `Add at least ${minNotes} notes.`}
        </Feedback>
      )}
      {result?.ok && <Feedback kind="correct">That&apos;s {exercise.chord}!</Feedback>}

      {outcome ? (
        <ResultPanel outcome={outcome} onRetry={reset} passAccuracy={passAccuracy} extra={<p>{outcome.details}</p>} />
      ) : (
        <div className="space-y-3">
          <HintButton hint={instrument === "guitar" && shape ? "Here's the usual shape — copy it onto the fretboard." : `Start on ${names[0]}, then add ${names.slice(1).join(" and ")}.`} />
          {instrument === "guitar" && shape && (
            <details>
              <summary className="cursor-pointer text-sm text-muted">Show the chord diagram</summary>
              <div className="mt-2">
                <ChordDiagram shape={shape} />
              </div>
            </details>
          )}
        </div>
      )}

      {!outcome && (
        <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Real instrument (optional)</p>
          {instrument === "piano" && midi.supported && midi.status !== "connected" && (
            <Button size="sm" variant="outline" onClick={midi.connect}>
              Connect MIDI keyboard
            </Button>
          )}
          <MicButton status={mic.status} error={mic.error} onStart={mic.start} onStop={mic.stop} label={`Listen to my ${instrument === "guitar" ? "strum" : "chord"}`} />
          {mic.listening && (
            <div className="space-y-1 text-sm">
              <p>
                Best guess: <strong>{chroma?.best?.symbol ?? "—"}</strong> · notes heard: {chroma?.activePcs.length ? chroma.activePcs.map((p) => compareChordTones(exercise.chord, []).name(p)).join(" ") : "—"}
              </p>
              <ProgressBar value={chroma?.confidence ?? 0} label="Detection confidence" tone="theory" />
              <p className="text-xs text-muted">Chord detection from a microphone is an estimate. We only accept it when the confidence stays high and every chord tone is heard; if it doesn&apos;t recognise your chord, strum again more evenly or check the strings one by one.</p>
            </div>
          )}
        </div>
      )}
      {instrument === "guitar" && shape && !outcome && checks >= 2 && (
        <Callout tone="info" title="Stuck?">Open the hint above to see the diagram, then copy it fret by fret.</Callout>
      )}
    </div>
  );
}
