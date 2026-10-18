"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ArrowRight, BookOpenCheck, CheckCircle2, ChevronDown, ChevronUp, Ear, Lightbulb, MessageCircleQuestion, Play, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { Badge, Button, Callout, Card, CardBody, CardHeader, ProgressBar, SourceTag, cn } from "@/components/ui";
import { PianoKeyboard, type KeyTone } from "@/components/instruments/piano-keyboard";
import { Fretboard, type FretMark } from "@/components/instruments/fretboard";
import { MicButton } from "@/components/instruments/mic-button";
import { NoteText } from "@/components/instruments/note-label";
import { usePrefs } from "@/hooks/use-prefs";
import { useNoteInput } from "@/hooks/use-note-input";
import { useMic } from "@/hooks/use-mic";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { useData } from "@/hooks/use-data";
import { playNote, playPianoChord, playSequence, strum } from "@/lib/audio/engine";
import { STANDARD_TUNING, positionsOfMidi } from "@/lib/music/guitar";
import { midiToName, mod12 } from "@/lib/music/notes";
import { mistakeSummary } from "@/lib/exercises/sequence";
import { coachReducer, currentExercise, initialSession, ladderFor, type AttemptResult, type CoachExercise } from "@/lib/coach/session";
import { summarizeResults } from "@/lib/coach/analysis";
import { exerciseRepo, profileRepo, progressRepo } from "@/lib/storage/repositories";
import { nextLesson } from "@/lib/progress/engine";
import { LESSONS } from "@/content/curriculum";
import type { ChromaFrame } from "@/lib/audio/microphone";
import type { LastExercise } from "@/lib/coach/schema";

const VERDICT_STYLE = {
  correct: { tone: "success" as const, icon: CheckCircle2, cls: "text-success" },
  close: { tone: "warn" as const, icon: CheckCircle2, cls: "text-warn" },
  octave: { tone: "warn" as const, icon: XCircle, cls: "text-warn" },
  wrong: { tone: "danger" as const, icon: XCircle, cls: "text-danger" },
  uncertain: { tone: "neutral" as const, icon: Ear, cls: "text-muted" },
};

/** Guitar fret position for each target (prefers the exercise's own positions). */
function positionFor(ex: CoachExercise, i: number) {
  if (ex.positions?.[i]) return ex.positions[i];
  return positionsOfMidi(ex.targets[i], 12)[0];
}

export function LessonCoach({ onResult }: { onResult?: (r: LastExercise) => void }) {
  const [prefs] = usePrefs();
  const [state, dispatch] = useReducer(coachReducer, prefs.instrument, (i) => initialSession(i));
  const ex = currentExercise(state);
  const ladder = ladderFor(state.instrument);
  const { ping } = usePracticeLog("Coach");
  const [heldVirtual, setHeldVirtual] = useState<Set<number>>(new Set());
  // Chord shape built on the virtual fretboard; scoped to the current attempt so it resets automatically.
  const attemptKey = `${state.instrument}-${state.index}-${state.attempts}`;
  const [shapeState, setShapeState] = useState<{ key: string; shape: Record<number, number> }>({ key: "", shape: {} });
  const guitarShape = useMemo(() => (shapeState.key === attemptKey ? shapeState.shape : {}), [shapeState, attemptKey]);
  const setGuitarShape = (fn: (g: Record<number, number>) => Record<number, number>) => setShapeState((st) => ({ key: attemptKey, shape: fn(st.key === attemptKey ? st.shape : {}) }));
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    dispatch({ type: "SET_INSTRUMENT", instrument: prefs.instrument });
  }, [prefs.instrument]);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  /* ---------------- Inputs ---------------- */

  const input = useNoteInput((midi, source, detail) => {
    ping();
    const s = stateRef.current;
    if (s.phase !== "try") return;
    if (currentExercise(s).kind === "chord") return; // chords handled separately
    dispatch({ type: "NOTE", midi, source, cents: detail?.note?.cents });
  });

  // MIDI chord: when ≥3 keys are held steadily, judge the chord.
  const midiHeldKey = [...input.midi.held].sort().join(",");
  useEffect(() => {
    if (ex.kind !== "chord" || state.phase !== "try" || input.midi.held.size < 3) return;
    const t = setTimeout(() => dispatch({ type: "CHORD", pcs: [...input.midi.held].map(mod12), source: "midi" }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiHeldKey, ex.kind, state.phase]);

  // Virtual piano chord: three or more keys held together.
  const virtualKey = [...heldVirtual].sort().join(",");
  useEffect(() => {
    if (ex.kind !== "chord" || state.instrument !== "piano" || state.phase !== "try" || heldVirtual.size < 3) return;
    const t = setTimeout(() => dispatch({ type: "CHORD", pcs: [...heldVirtual].map(mod12), source: "virtual" }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualKey, ex.kind, state.instrument, state.phase]);

  // Microphone chord estimate: collect frames for ~1.2 s after a strum, then judge the most confident one.
  const chordWindow = useRef<{ start: number; best: ChromaFrame | null } | null>(null);
  const chordMic = useMic({
    a4: prefs.a4,
    mode: "chroma",
    onChroma: (f) => {
      const s = stateRef.current;
      if (s.phase !== "try" || currentExercise(s).kind !== "chord") return;
      const now = performance.now();
      if (!chordWindow.current) {
        if (f.level < 0.05) return;
        chordWindow.current = { start: now, best: f };
        return;
      }
      const w = chordWindow.current;
      if (!w.best || f.confidence > w.best.confidence) w.best = f;
      if (now - w.start > 1200) {
        const best = w.best!;
        chordWindow.current = null;
        dispatch({ type: "CHORD", pcs: best.activePcs, source: "mic", confidence: best.confidence });
      }
    },
  });

  // Mic pitch: if there's sound but no stable pitch for 2.5 s, ask for a clearer replay instead of guessing.
  const unclearSince = useRef<number | null>(null);
  const pitch = input.mic.pitch;
  useEffect(() => {
    if (!pitch || state.phase !== "try") {
      unclearSince.current = null;
      return;
    }
    if (pitch.level > 0.03 && !pitch.stable) {
      unclearSince.current ??= performance.now();
      if (performance.now() - unclearSince.current > 2500) {
        unclearSince.current = null;
        dispatch({ type: "UNCERTAIN", reason: pitch.level > 0.25 ? "noisy" : "unclear" });
      }
    } else unclearSince.current = null;
  }, [pitch, state.phase]);

  /* ---------------- Persist results ---------------- */

  const savedCount = useRef(0);
  useEffect(() => {
    if (state.results.length <= savedCount.current) return;
    const fresh = state.results.slice(savedCount.current);
    savedCount.current = state.results.length;
    fresh.forEach((r: AttemptResult) => {
      const e = ladder.find((x) => x.id === r.exerciseId) ?? ex;
      const total = e.kind === "chord" ? 1 : e.targets.length;
      void exerciseRepo.add({
        instrument: state.instrument,
        exerciseId: r.exerciseId,
        skill: e.skill,
        input: r.input,
        correct: Math.round(r.accuracy * total),
        total,
        accuracy: r.accuracy,
        measured: r.measured,
        details: `Coach: ${r.title}`,
      });
      onResult?.({
        exerciseId: r.title,
        accuracy: r.accuracy,
        input: r.input,
        measured: r.measured,
        mistakes: e.kind === "sequence" ? (mistakeSummary(state.seq, (m) => midiToName(m)) ?? undefined) : state.feedback?.detail.slice(0, 380),
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.results.length]);

  /* ---------------- Actions ---------------- */

  const demo = async () => {
    dispatch({ type: "DEMO" });
    ping();
    if (ex.kind === "chord") {
      if (ex.instrument === "guitar") await strum(ex.targets);
      else await playPianoChord(ex.targets, 1.4);
    } else if (ex.targets.length === 1) await playNote(ex.instrument, ex.targets[0], 0, 1);
    else await playSequence(ex.instrument, ex.targets, 0.6);
  };

  const listen = async () => {
    dispatch({ type: "TRY" });
    if (ex.kind === "chord") {
      input.mic.stop();
      await chordMic.start();
    } else {
      chordMic.stop();
      await input.mic.start();
    }
  };
  const micStatus = ex.kind === "chord" ? chordMic : input.mic;
  const stopMic = () => {
    input.mic.stop();
    chordMic.stop();
  };

  const checkGuitarChord = () => {
    const midis = Object.entries(guitarShape).map(([s, f]) => STANDARD_TUNING[Number(s)] + f);
    dispatch({ type: "CHORD", pcs: midis.map(mod12), source: "virtual" });
  };

  /* ---------------- Visual targets ---------------- */

  const doneCount = ex.kind === "chord" ? 0 : state.seq.index;
  const lastWrong = state.played.length && !state.played[state.played.length - 1].ok ? state.played[state.played.length - 1].midi : null;

  const pianoHighlight = useMemo(() => {
    const h: Partial<Record<number, KeyTone>> = {};
    if (ex.instrument !== "piano") return h;
    if (ex.kind === "chord") ex.targets.forEach((t) => (h[t] = "chord"));
    else {
      ex.targets.forEach((t, i) => {
        if (i < doneCount) h[t] ??= "correct";
      });
      const next = ex.targets[doneCount];
      if (next !== undefined) h[next] = "target";
    }
    if (lastWrong !== null && h[lastWrong] === undefined) h[lastWrong] = "wrong";
    return h;
  }, [ex, doneCount, lastWrong]);

  const pianoFingers = useMemo(() => {
    const f: Partial<Record<number, number>> = {};
    if (ex.instrument === "piano" && ex.fingers) ex.targets.forEach((t, i) => (f[t] ??= ex.fingers![i]));
    return f;
  }, [ex]);

  const fretMarks = useMemo<FretMark[]>(() => {
    if (ex.instrument !== "guitar") return [];
    if (ex.kind === "chord") {
      const target = (ex.positions ?? []).map((p) => ({ ...p, tone: "chord" as const }));
      const mine = Object.entries(guitarShape).map(([s, f]) => ({ string: Number(s), fret: f, tone: "target" as const, label: "●" }));
      return state.phase === "try" ? [...target.filter((t) => guitarShape[t.string] === undefined), ...mine] : target;
    }
    return ex.targets.map((_, i) => {
      const p = positionFor(ex, i);
      const tone = i < doneCount ? ("correct" as const) : i === doneCount ? ("target" as const) : ("hint" as const);
      return { ...p, tone, finger: ex.fingers?.[i] || undefined };
    });
  }, [ex, doneCount, guitarShape, state.phase]);

  const activeString = ex.instrument === "guitar" && ex.kind !== "chord" ? positionFor(ex, Math.min(doneCount, ex.targets.length - 1))?.string : undefined;

  /* ---------------- Render ---------------- */

  const fb = state.feedback;
  const V = fb ? VERDICT_STYLE[fb.verdict] : null;
  const { data: progress } = useData(() => progressRepo.all(), ["lessonProgress"], {});
  const { data: profile } = useData(() => profileRepo.get(), ["profile"], undefined);
  const suggested = nextLesson(LESSONS, progress, [state.instrument, "theory"], profile?.placement);

  if (state.phase === "complete") {
    return (
      <Card>
        <CardHeader icon={<Sparkles className="h-5 w-5" />} title="You finished the coach ladder!" description="Every exercise in this set is done." />
        <CardBody className="space-y-4">
          <p className="text-sm">{summarizeResults(state.results)}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => dispatch({ type: "GOTO", index: 0 })}>
              <RotateCcw className="h-4 w-4" /> Start again
            </Button>
            {suggested && (
              <Link href={`/lesson/${suggested.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border-strong px-4 text-sm font-medium hover:bg-surface-2">
                Next lesson: {suggested.title} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<BookOpenCheck className="h-5 w-5" />}
        title="Lesson coach"
        description={`Step ${state.index + 1} of ${ladder.length} · ${state.instrument === "guitar" ? "Guitar" : "Piano"}`}
        action={<Badge tone={state.instrument}>{ex.skill}</Badge>}
      />
      <CardBody className="space-y-4">
        <ProgressBar value={state.index / ladder.length} tone={state.instrument} label="Coach ladder progress" />

        {/* Teacher speech */}
        <div className="rounded-2xl bg-surface-2 p-4" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{ex.title}</p>
          <p className="mt-1.5 leading-relaxed">{ex.explain}</p>
          {state.hintShown && (
            <p className="mt-3 flex gap-2 rounded-xl bg-warn-soft p-3 text-sm">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warn" /> {ex.hint}
            </p>
          )}
          {state.phase === "try" && !fb && (
            <p className="mt-3 text-sm font-medium text-accent">
              {ex.kind === "chord"
                ? state.instrument === "piano"
                  ? "Your turn: hold the chord keys together (on screen, MIDI) — or play it on your real piano with the mic on."
                  : "Your turn: strum the chord on your guitar with the mic on — or build the shape on the fretboard below and press Check."
                : `Your turn: play ${ex.targets.length > 1 ? `note ${doneCount + 1} of ${ex.targets.length}` : "the note"} — on screen, a MIDI keyboard, or your real instrument with the mic on.`}
            </p>
          )}
        </div>

        {/* Feedback */}
        {fb && V && (
          <div className={cn("rounded-2xl border p-4", fb.verdict === "correct" ? "border-success/40 bg-success-soft" : fb.verdict === "uncertain" ? "border-border bg-surface-2" : fb.verdict === "wrong" ? "border-danger/30 bg-danger-soft" : "border-warn/30 bg-warn-soft")} role="status" data-testid="coach-feedback">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={cn("flex items-center gap-2 font-semibold", V.cls)}>
                <V.icon className="h-5 w-5" /> {fb.title}
              </p>
              {fb.verdict !== "uncertain" && <SourceTag source={state.lastInput === "virtual" || state.lastInput === "midi" || state.lastInput === "mic" ? "measured" : "rules"} />}
            </div>
            <p className="mt-1.5 text-sm">{fb.detail}</p>
            {fb.tip && (
              <p className="mt-2 flex gap-2 text-sm text-muted">
                <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0" /> <span>
                  <span className="font-medium text-text">Coaching tip: </span>
                  {fb.tip}
                </span>
              </p>
            )}
            {fb.link && (
              <Link href={fb.link.href} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                {fb.link.label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {state.lastInput && fb.verdict !== "uncertain" && (
              <p className="mt-2 text-xs text-muted">
                Measured from {state.lastInput === "mic" ? "the microphone (pitch detection)" : state.lastInput === "midi" ? "your MIDI keyboard" : "the on-screen instrument"}. Technique such as finger pressure or posture can&apos;t be measured — use the self-check tips.
              </p>
            )}
          </div>
        )}

        {/* Played notes trail */}
        {ex.kind !== "chord" && state.played.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Notes you played">
            <span className="text-muted">You played:</span>
            {state.played.map((p, i) => (
              <Badge key={i} tone={p.ok ? "success" : "danger"}>
                <NoteText midi={p.midi} withOctave mode="western" />
              </Badge>
            ))}
          </div>
        )}

        {/* Suggestion from adaptation */}
        {state.suggestion && state.phase === "feedback" && (
          <Callout tone="info" icon={<Sparkles className="h-4 w-4 text-piano" />} title={state.suggestion === "harder" ? "That was perfect — ready for something harder?" : "This one's tricky. Want to go back a step?"}>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => dispatch({ type: state.suggestion === "harder" ? "HARDER" : "EASIER" })}>
                {state.suggestion === "harder" ? "Make it harder" : "Make it easier"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "RETRY" })}>
                Stay here
              </Button>
            </div>
          </Callout>
        )}

        {/* Main controls */}
        <div className="flex flex-wrap gap-2">
          {state.phase === "feedback" ? (
            <>
              {fb?.verdict === "correct" || fb?.verdict === "close" ? (
                <Button onClick={() => dispatch({ type: "NEXT" })} data-testid="coach-next">
                  Next exercise <ArrowRight className="h-4 w-4" />
                </Button>
              ) : null}
              <Button variant={fb?.verdict === "correct" ? "secondary" : "primary"} onClick={() => dispatch({ type: "RETRY" })} data-testid="coach-retry">
                <RotateCcw className="h-4 w-4" /> Try again
              </Button>
            </>
          ) : state.phase !== "try" ? (
            <Button onClick={() => dispatch({ type: "TRY" })} data-testid="coach-try">
              I&apos;m ready — let me try
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => void demo()}>
            <Play className="h-4 w-4" /> Play an example
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: "EXPLAIN" })}>
            Explain again
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: "HINT" })} disabled={state.hintShown}>
            <Lightbulb className="h-4 w-4" /> Give me a hint
          </Button>
        </div>

        <MicButton status={micStatus.status} error={micStatus.error} onStart={() => void listen()} onStop={stopMic} label="Listen to me" />
        {ex.kind === "chord" && <p className="-mt-1 text-xs text-muted">Chord listening is a best-effort estimate with a confidence check. If it isn&apos;t sure, it will ask you to replay rather than guess.</p>}
        {input.midi.supported && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {input.midi.status === "connected" ? (
              <Badge tone="success">MIDI: {input.midi.devices.join(", ") || "waiting for a device"}</Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void input.midi.connect()}>
                Connect MIDI keyboard
              </Button>
            )}
            {input.midi.error && <span className="text-danger">{input.midi.error}</span>}
          </div>
        )}

        {/* Instrument */}
        {state.instrument === "piano" ? (
          <PianoKeyboard
            low={48}
            high={72}
            whiteKeyWidth={40}
            height={160}
            focusMidi={60}
            highlight={pianoHighlight}
            fingers={pianoFingers}
            pressed={input.midi.held}
            labels="white"
            ariaLabel="Practice keyboard"
            onNoteOn={(m) => {
              ping();
              if (ex.kind === "chord") setHeldVirtual((h) => new Set(h).add(m));
              else if (stateRef.current.phase === "try") dispatch({ type: "NOTE", midi: m, source: "virtual" });
            }}
            onNoteOff={(m) =>
              setHeldVirtual((h) => {
                const n = new Set(h);
                n.delete(m);
                return n;
              })
            }
          />
        ) : (
          <div className="space-y-2">
            <Fretboard
              frets={12}
              marks={fretMarks}
              activeString={activeString}
              ariaLabel="Practice fretboard"
              onPlay={({ string, fret, midi }) => {
                ping();
                if (ex.kind === "chord") {
                  if (stateRef.current.phase !== "try") return;
                  setGuitarShape((g) => {
                    const n = { ...g };
                    if (n[string] === fret) delete n[string];
                    else n[string] = fret;
                    return n;
                  });
                } else if (stateRef.current.phase === "try") dispatch({ type: "NOTE", midi, source: "virtual" });
              }}
            />
            {ex.kind === "chord" && state.phase === "try" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={checkGuitarChord} disabled={Object.keys(guitarShape).length < 3}>
                  Check my shape
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void strum(Object.entries(guitarShape).map(([s, f]) => STANDARD_TUNING[Number(s)] + f))} disabled={!Object.keys(guitarShape).length}>
                  Strum my shape
                </Button>
                <span className="text-xs text-muted">Tap one fret per string you want to ring (tap again to remove). Unselected strings count as muted.</span>
              </div>
            )}
          </div>
        )}

        {/* Ladder controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => dispatch({ type: "EASIER" })} disabled={state.index === 0}>
              <ChevronDown className="h-4 w-4" /> Make it easier
            </Button>
            <Button size="sm" variant="outline" onClick={() => dispatch({ type: "HARDER" })}>
              <ChevronUp className="h-4 w-4" /> Make it harder
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowSummary((v) => !v)} aria-expanded={showSummary}>
            Practice summary
          </Button>
        </div>
        {showSummary && (
          <div className="space-y-3 rounded-2xl bg-surface-2 p-4 text-sm" data-testid="coach-summary">
            <div className="flex items-center gap-2">
              <span className="font-semibold">This session</span>
              <SourceTag source="measured" />
            </div>
            <p>{summarizeResults(state.results)}</p>
            {suggested ? (
              <p>
                Suggested next lesson:{" "}
                <Link href={`/lesson/${suggested.id}`} className="font-medium text-accent hover:underline">
                  {suggested.title}
                </Link>
              </p>
            ) : (
              <p className="text-muted">Browse the curriculum for your next lesson.</p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
