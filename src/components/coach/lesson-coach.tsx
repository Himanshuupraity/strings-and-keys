"use client";
import { lessonText, useLang, useT, useTm } from "@/lib/i18n";

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
import { summarizeResultsMessages } from "@/lib/coach/analysis";
import { COACH_HI } from "@/content/i18n/coach-hi";
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
  const tr = useT();
  const tm = useTm();
  const lang = useLang();
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
  const coachText = (x: { id: string; title: string; explain: string; hint: string }) => (lang === "hi" && COACH_HI[x.id]) || x;
  const summary = summarizeResultsMessages(state.results.map((r) => ({ ...r, title: lang === "hi" ? (COACH_HI[r.exerciseId]?.title ?? r.title) : r.title }))).map(tm).join(" ");

  if (state.phase === "complete") {
    return (
      <Card>
        <CardHeader icon={<Sparkles className="h-5 w-5" />} title={tr("ui.you_finished_the_coach_ladder")} description={tr("ui.every_exercise_in_this_set_is_done")} />
        <CardBody className="space-y-4">
          <p className="text-sm">{summary}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => dispatch({ type: "GOTO", index: 0 })}>
              <RotateCcw className="h-4 w-4" /> {tr("ui.start_again")}
            </Button>
            {suggested && (
              <Link href={`/lesson/${suggested.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border-strong px-4 text-sm font-medium hover:bg-surface-2">
                {tr("ui.next_lesson_x", { title: lessonText(suggested, lang).title })} <ArrowRight className="h-4 w-4" />
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
        title={tr("ui.lesson_coach")}
        description={`Step ${state.index + 1} of ${ladder.length} · ${state.instrument === "guitar" ? "Guitar" : "Piano"}`}
        action={<Badge tone={state.instrument}>{ex.skill}</Badge>}
      />
      <CardBody className="space-y-4">
        <ProgressBar value={state.index / ladder.length} tone={state.instrument} label={tr("ui.coach_ladder_progress")} />

        {/* Teacher speech */}
        <div className="rounded-2xl bg-surface-2 p-4" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{coachText(ex).title}</p>
          <p className="mt-1.5 leading-relaxed">{coachText(ex).explain}</p>
          {state.hintShown && (
            <p className="mt-3 flex gap-2 rounded-xl bg-warn-soft p-3 text-sm">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warn" /> {coachText(ex).hint}
            </p>
          )}
          {state.phase === "try" && !fb && (
            <p className="mt-3 text-sm font-medium text-accent">
              {ex.kind === "chord"
                ? state.instrument === "piano"
                  ? tr("ui.your_turn_hold_the_chord_keys_together_on_screen")
                  : tr("ui.your_turn_strum_the_chord_on_your_guitar_with_th")
                : ex.targets.length > 1 ? tr("ui.your_turn_note_of", { i: doneCount + 1, n: ex.targets.length }) : tr("ui.your_turn_the_note")}
            </p>
          )}
        </div>

        {/* Feedback */}
        {fb && V && (
          <div className={cn("rounded-2xl border p-4", fb.verdict === "correct" ? "border-success/40 bg-success-soft" : fb.verdict === "uncertain" ? "border-border bg-surface-2" : fb.verdict === "wrong" ? "border-danger/30 bg-danger-soft" : "border-warn/30 bg-warn-soft")} role="status" data-testid="coach-feedback">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={cn("flex items-center gap-2 font-semibold", V.cls)}>
                <V.icon className="h-5 w-5" /> {fb.titleMsg ? tm(fb.titleMsg) : fb.title}
              </p>
              {fb.verdict !== "uncertain" && <SourceTag source={state.lastInput === "virtual" || state.lastInput === "midi" || state.lastInput === "mic" ? "measured" : "rules"} />}
            </div>
            <p className="mt-1.5 text-sm">{fb.detailMsg ? tm(fb.detailMsg) : fb.detail}</p>
            {fb.tip && (
              <p className="mt-2 flex gap-2 text-sm text-muted">
                <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0" /> <span>
                  <span className="font-medium text-text">{tr("ui.coaching_tip_2")} </span>
                  {fb.tipMsg ? tm(fb.tipMsg) : fb.tip}
                </span>
              </p>
            )}
            {fb.link && (
              <Link href={fb.link.href} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                {fb.link.labelKey ? tr(fb.link.labelKey) : fb.link.label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {state.lastInput && fb.verdict !== "uncertain" && (
              <p className="mt-2 text-xs text-muted">
                {tr(state.lastInput === "mic" ? "ui.measured_from_mic_coach" : state.lastInput === "midi" ? "ui.measured_from_midi_coach" : "ui.measured_from_screen_coach")}
              </p>
            )}
          </div>
        )}

        {/* Played notes trail */}
        {ex.kind !== "chord" && state.played.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm" aria-label={tr("ui.notes_you_played")}>
            <span className="text-muted">{tr("ui.you_played")}</span>
            {state.played.map((p, i) => (
              <Badge key={i} tone={p.ok ? "success" : "danger"}>
                <NoteText midi={p.midi} withOctave mode="western" />
              </Badge>
            ))}
          </div>
        )}

        {/* Suggestion from adaptation */}
        {state.suggestion && state.phase === "feedback" && (
          <Callout tone="info" icon={<Sparkles className="h-4 w-4 text-piano" />} title={state.suggestion === "harder" ? tr("ui.that_was_perfect_ready_for_something_harder") : tr("ui.this_one_s_tricky_want_to_go_back_a_step")}>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => dispatch({ type: state.suggestion === "harder" ? "HARDER" : "EASIER" })}>
                {state.suggestion === "harder" ? tr("ui.make_it_harder") : tr("ui.make_it_easier")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "RETRY" })}>
                {tr("ui.stay_here")}
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
                  {tr("ui.next_exercise")} <ArrowRight className="h-4 w-4" />
                </Button>
              ) : null}
              <Button variant={fb?.verdict === "correct" ? "secondary" : "primary"} onClick={() => dispatch({ type: "RETRY" })} data-testid="coach-retry">
                <RotateCcw className="h-4 w-4" /> {tr("ui.try_again")}
              </Button>
            </>
          ) : state.phase !== "try" ? (
            <Button onClick={() => dispatch({ type: "TRY" })} data-testid="coach-try">
              I&apos;m ready — let me try
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => void demo()}>
            <Play className="h-4 w-4" /> {tr("lesson.playExample")}
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: "EXPLAIN" })}>
            {tr("lesson.explainAgain")}
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: "HINT" })} disabled={state.hintShown}>
            <Lightbulb className="h-4 w-4" /> {tr("lesson.hint")}
          </Button>
        </div>

        <MicButton status={micStatus.status} error={micStatus.error} onStart={() => void listen()} onStop={stopMic} label={tr("ui.listen_to_me")} />
        {ex.kind === "chord" && <p className="-mt-1 text-xs text-muted">{tr("ui.chord_listening_is_a_best_effort_estimate_with_a")}</p>}
        {input.midi.supported && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {input.midi.status === "connected" ? (
              <Badge tone="success">MIDI: {input.midi.devices.join(", ") || "waiting for a device"}</Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void input.midi.connect()}>
                {tr("ui.connect_midi_keyboard")}
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
            ariaLabel={tr("ui.practice_keyboard")}
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
              ariaLabel={tr("ui.practice_fretboard")}
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
                  {tr("ui.check_my_shape")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void strum(Object.entries(guitarShape).map(([s, f]) => STANDARD_TUNING[Number(s)] + f))} disabled={!Object.keys(guitarShape).length}>
                  {tr("ui.strum_my_shape")}
                </Button>
                <span className="text-xs text-muted">{tr("ui.tap_one_fret_per_string_you_want_to_ring_tap_aga")}</span>
              </div>
            )}
          </div>
        )}

        {/* Ladder controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => dispatch({ type: "EASIER" })} disabled={state.index === 0}>
              <ChevronDown className="h-4 w-4" /> {tr("ui.make_it_easier")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => dispatch({ type: "HARDER" })}>
              <ChevronUp className="h-4 w-4" /> {tr("ui.make_it_harder")}
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowSummary((v) => !v)} aria-expanded={showSummary}>
            {tr("ui.practice_summary")}
          </Button>
        </div>
        {showSummary && (
          <div className="space-y-3 rounded-2xl bg-surface-2 p-4 text-sm" data-testid="coach-summary">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{tr("ui.this_session")}</span>
              <SourceTag source="measured" />
            </div>
            <p>{summary}</p>
            {suggested ? (
              <p>
                {tr("ui.suggested_next_lesson")}{" "}
                <Link href={`/lesson/${suggested.id}`} className="font-medium text-accent hover:underline">
                  {lessonText(suggested, lang).title}
                </Link>
              </p>
            ) : (
              <p className="text-muted">{tr("ui.browse_the_curriculum_for_your_next_lesson")}</p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
