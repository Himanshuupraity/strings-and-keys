"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronLeft, ClipboardCheck, Clock, Dumbbell, Ear, Eye, GraduationCap,
  Languages, ListChecks, Lock, MessageCircleQuestion, RotateCcw, Sparkles, Trophy,
} from "lucide-react";
import type { AudioExample, Exercise, Lesson, LessonStep } from "@/content/types";
import { LEVEL_NAMES } from "@/content/types";
import { LESSONS, getLesson } from "@/content/curriculum";
import { Badge, Button, Callout, Card, ProgressBar, Skeleton, cn } from "@/components/ui";
import { useData } from "@/hooks/use-data";
import { useHydrated, usePrefs } from "@/hooks/use-prefs";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { exerciseRepo, profileRepo, progressRepo } from "@/lib/storage/repositories";
import { isDone, isUnlocked, MASTERY_EXPLANATION, masteryStepIds, nextLesson } from "@/lib/progress/engine";
import type { LessonProgress, Track } from "@/lib/storage/schemas";
import { RichText } from "./rich-text";
import { PlayExample } from "./play-example";
import { VisualRenderer } from "./visual";
import { ExerciseRenderer } from "./exercises";
import { LessonQuiz } from "./quiz";
import { resolveInstrument, type ExerciseOutcome, type Inst } from "./utils";

type View = { kind: "step"; index: number } | { kind: "quiz" } | { kind: "done" };

const KIND_META: Record<LessonStep["kind"], { label: string; icon: typeof BookOpen }> = {
  explain: { label: "Learn", icon: BookOpen },
  listen: { label: "Listen", icon: Ear },
  visual: { label: "Look", icon: Eye },
  exercise: { label: "Practice", icon: Dumbbell },
  "self-check": { label: "Self-check", icon: ClipboardCheck },
};

const TRACK_TONE: Record<Track, "theory" | "guitar" | "piano"> = { theory: "theory", guitar: "guitar", piano: "piano" };

/** An audio demonstration for an exercise step ("Play an example"). */
export function exampleForExercise(e: Exercise): AudioExample | null {
  switch (e.type) {
    case "play-sequence":
      return { type: "notes", notes: e.notes, step: 0.55 };
    case "play-chord":
      return { type: "chord", chord: e.chord, strum: true };
    case "mic-note":
      return { type: "notes", notes: [e.note], step: 1.5 };
    case "tap-rhythm":
      return { type: "rhythm", pattern: Array.from({ length: e.bars }, (_, b) => e.pattern.map((p) => p + b * e.beatsPerBar)).flat(), bpm: e.bpm, beatsPerBar: e.beatsPerBar };
    default:
      return null;
  }
}

function hintForExplain(step: LessonStep, lesson: Lesson): string | null {
  if (step.hinglish) return null;
  const terms = (lesson.glossary ?? []).filter((g) => step.body.toLowerCase().includes(g.term.toLowerCase().split(/[ (]/)[0]));
  if (terms.length) return terms.map((t) => `${t.term}: ${t.meaning}`).join("\n\n");
  return null;
}

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const lesson = getLesson(lessonId)!;
  const [prefs] = usePrefs();
  const hydrated = useHydrated();
  const { data: all, loading } = useData<Record<string, LessonProgress>>(() => progressRepo.all(), ["lessonProgress"], {});
  const { data: profile } = useData(() => profileRepo.get(), ["profile"], undefined);
  const progress = all[lesson.id];
  const instrument: Inst = resolveInstrument(undefined, lesson, prefs.instrument);
  const log = usePracticeLog(lesson.title, { lessonId: lesson.id, instrument: lesson.track === "theory" ? undefined : lesson.track });
  const unlocked = isUnlocked(lesson, all, profile?.placement) || isDone(progress);

  const [view, setView] = useState<View>({ kind: "step", index: 0 });
  const [resumed, setResumed] = useState(false);
  const [explainAgain, setExplainAgain] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Open the lesson (in-progress) once we know it's unlocked. Never marks it complete.
  useEffect(() => {
    if (loading || !unlocked) return;
    void progressRepo.open(lesson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, unlocked, lesson.id]);

  // Resume at the first unfinished step once progress has loaded (state adjusted during render, once).
  if (!loading && !resumed) {
    setResumed(true);
    if (progress && !isDone(progress)) {
      const idx = lesson.steps.findIndex((s) => !progress.stepsDone.includes(s.id));
      if (idx > 0) setView({ kind: "step", index: idx });
      else if (idx === -1 && lesson.quiz.length) setView({ kind: "quiz" });
    }
  }

  const go = useCallback(
    (v: View) => {
      setExplainAgain(false);
      setView(v);
      log.ping();
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [log],
  );

  const stepsDone = progress?.stepsDone ?? [];
  const completion = (stepsDone.filter((id) => lesson.steps.some((s) => s.id === id)).length + (progress?.quizBest !== null && progress?.quizBest !== undefined && progress.quizBest >= lesson.passScore ? 1 : 0)) / (lesson.steps.length + (lesson.quiz.length ? 1 : 0));

  const next = useMemo(() => {
    const tracks: Track[] = lesson.track === "theory" ? ["theory", prefs.instrument] : ["theory", lesson.track];
    return nextLesson(LESSONS.filter((l) => l.id !== lesson.id), all, tracks, profile?.placement);
  }, [all, lesson, prefs.instrument, profile?.placement]);

  const finishStep = async (step: LessonStep) => {
    if (step.kind !== "exercise" && !stepsDone.includes(step.id)) await progressRepo.completeStep(lesson, step.id);
  };

  const advance = async (index: number) => {
    const step = lesson.steps[index];
    if (step.kind !== "exercise" && step.kind !== "self-check") await finishStep(step);
    if (index < lesson.steps.length - 1) go({ kind: "step", index: index + 1 });
    else go(lesson.quiz.length ? { kind: "quiz" } : { kind: "done" });
  };

  const onOutcome = async (step: Extract<LessonStep, { kind: "exercise" }>, o: ExerciseOutcome) => {
    log.ping();
    try {
      await progressRepo.recordExercise(lesson, step.id, o.accuracy, true);
      await exerciseRepo.add({
        instrument: lesson.track === "theory" ? "theory" : lesson.track,
        exerciseId: `${lesson.id}/${step.id}`,
        lessonId: lesson.id,
        skill: lesson.skills[0],
        input: o.input,
        correct: o.correct,
        total: o.total,
        accuracy: o.accuracy,
        measured: o.measured,
        details: o.details,
      });
      if (step.mastery && o.accuracy >= (step.passAccuracy ?? 0.8)) toast.success("Mastery evidence saved for this lesson.");
    } catch {
      toast.error("Couldn't save this result. You can keep practising.");
    }
  };

  if (!hydrated || loading) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const header = (
    <div className="mb-6 space-y-3">
      <Link href={`/learn${lesson.track === "theory" ? "" : `/${lesson.track}`}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" /> {lesson.track === "theory" ? "Curriculum" : lesson.track === "guitar" ? "Guitar course" : "Piano course"}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TRACK_TONE[lesson.track]}>{lesson.track === "theory" ? "Music theory" : lesson.track === "guitar" ? "Guitar" : "Piano"}</Badge>
        <Badge>
          Level {lesson.level} · {LEVEL_NAMES[lesson.level]}
        </Badge>
        <Badge>
          <Clock className="h-3 w-3" /> {lesson.minutes} min
        </Badge>
        {progress?.status === "mastered" && (
          <Badge tone="success">
            <Trophy className="h-3 w-3" /> Mastered
          </Badge>
        )}
        {progress?.status === "completed" && (
          <Badge tone="success">
            <CheckCircle2 className="h-3 w-3" /> Completed
          </Badge>
        )}
      </div>
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{lesson.title}</h1>
      <p className="max-w-2xl text-muted">{lesson.summary}</p>
      {unlocked && <ProgressBar value={completion} tone={lesson.track === "theory" ? "theory" : lesson.track} label="Lesson progress" className="max-w-md" />}
    </div>
  );

  if (!unlocked) {
    return (
      <div>
        {header}
        <Card className="max-w-2xl p-6">
          <div className="flex items-start gap-3">
            <Lock className="mt-1 h-5 w-5 text-muted" />
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">This lesson is locked</h2>
              <p className="text-sm text-muted">Finish these lessons first (complete their steps and pass their quizzes). Already know this material? Take the placement quiz to skip ahead.</p>
              <ul className="space-y-2">
                {lesson.prerequisites.map((id) => {
                  const p = getLesson(id);
                  const done = isDone(all[id]);
                  return (
                    <li key={id} className="flex items-center gap-2 text-sm">
                      {done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <span className="h-4 w-4 rounded-full border-2 border-border-strong" />}
                      <Link href={`/lesson/${id}`} className="font-medium hover:text-accent">
                        {p?.title ?? id}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Link href="/learn/diagnostic" className="inline-flex h-10 items-center rounded-xl border border-border-strong px-4 text-sm font-medium hover:bg-surface-2">
                  Take the placement quiz
                </Link>
                <Link href="/learn" className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-muted hover:bg-surface-2">
                  Back to curriculum
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const rail = (
    <nav aria-label="Lesson steps" className="lg:sticky lg:top-24">
      <ol className="scrollbar-thin flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible">
        {lesson.steps.map((s, i) => {
          const Icon = KIND_META[s.kind].icon;
          const active = view.kind === "step" && view.index === i;
          const done = stepsDone.includes(s.id);
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => go({ kind: "step", index: i })}
                aria-current={active ? "step" : undefined}
                className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors", active ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-surface-2 hover:text-text")}
              >
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", done ? "bg-success text-white dark:text-black" : "bg-surface-3")}>{done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}</span>
                <span className="max-w-40 truncate lg:max-w-none">{s.title}</span>
              </button>
            </li>
          );
        })}
        {lesson.quiz.length > 0 && (
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => go({ kind: "quiz" })}
              aria-current={view.kind === "quiz" ? "step" : undefined}
              className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors", view.kind === "quiz" ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-surface-2 hover:text-text")}
            >
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", (progress?.quizBest ?? 0) >= lesson.passScore ? "bg-success text-white dark:text-black" : "bg-surface-3")}>
                <MessageCircleQuestion className="h-3.5 w-3.5" />
              </span>
              Quiz
            </button>
          </li>
        )}
      </ol>
      {lesson.glossary && lesson.glossary.length > 0 && (
        <details className="mt-4 hidden rounded-xl border border-border bg-surface p-3 lg:block">
          <summary className="cursor-pointer text-sm font-medium">Words in this lesson</summary>
          <dl className="mt-2 space-y-2 text-sm">
            {lesson.glossary.map((g) => (
              <div key={g.term}>
                <dt className="font-medium">{g.term}</dt>
                <dd className="text-muted">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </nav>
  );

  let content: React.ReactNode;
  if (view.kind === "step") {
    const step = lesson.steps[view.index];
    const meta = KIND_META[step.kind];
    const isExercise = step.kind === "exercise";
    const stepInstrument = isExercise ? resolveInstrument("instrument" in step.exercise ? step.exercise.instrument : undefined, lesson, prefs.instrument) : instrument;
    const audio = "audio" in step && step.audio ? step.audio : isExercise ? exampleForExercise(step.exercise) : null;
    const altText = step.hinglish ?? hintForExplain(step, lesson);
    const showHinglish = prefs.hinglish && step.hinglish;
    const done = stepsDone.includes(step.id);
    const best = progress?.exerciseBest[step.id];

    content = (
      <Card className="p-5 sm:p-7" key={step.id}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={step.kind === "exercise" ? "accent" : step.kind === "self-check" ? "warn" : "neutral"}>
            <meta.icon className="h-3 w-3" /> {meta.label}
          </Badge>
          <span className="text-xs text-subtle">
            Step {view.index + 1} of {lesson.steps.length}
          </span>
          {isExercise && step.mastery && (
            <Badge tone="success" title="Passing this measured exercise counts as demonstrated proficiency">
              <Trophy className="h-3 w-3" /> Mastery check · {Math.round((step.passAccuracy ?? 0.8) * 100)}%
            </Badge>
          )}
          {best !== undefined && <span className="text-xs text-muted">Best: {Math.round(best * 100)}%</span>}
        </div>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight">{step.title}</h2>
        <RichText text={step.body} glossary={lesson.glossary} />

        {(showHinglish || explainAgain) && altText && (
          <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4 text-sm">
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              {step.hinglish ? <Languages className="h-4 w-4 text-accent" /> : <Sparkles className="h-4 w-4 text-accent" />}
              {step.hinglish ? "Hinglish mein samjhiye" : "In other words"}
            </p>
            <RichText text={altText} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {audio && <PlayExample audio={audio} instrument={stepInstrument} onPlay={log.ping} />}
          {altText && !showHinglish && (
            <Button variant="ghost" onClick={() => setExplainAgain((e) => !e)} aria-pressed={explainAgain}>
              <RotateCcw className="h-4 w-4" /> {explainAgain ? "Hide explanation" : "Explain again"}
            </Button>
          )}
        </div>

        {"visual" in step && step.visual && (
          <div className="mt-5">
            <VisualRenderer visual={step.visual} onInteract={log.ping} />
          </div>
        )}

        {isExercise && (
          <div className="mt-6 border-t border-border pt-6">
            <ExerciseRenderer key={step.id} exercise={step.exercise} instrument={stepInstrument} track={lesson.track} passAccuracy={step.mastery ? step.passAccuracy ?? 0.8 : undefined} onComplete={(o) => void onOutcome(step, o)} onActivity={log.ping} />
          </div>
        )}

        {step.kind === "self-check" && (
          <div className="mt-6 space-y-3 border-t border-border pt-6">
            <Badge tone="warn">
              <ListChecks className="h-3 w-3" /> Self-assessment — not measured
            </Badge>
            <ul className="space-y-2">
              {step.checklist.map((c, k) => {
                const key = `${step.id}:${k}`;
                return (
                  <li key={key}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 hover:bg-surface-2">
                      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={!!checked[key] || done} onChange={(e) => setChecked((s) => ({ ...s, [key]: e.target.checked }))} />
                      <span className="text-sm">{c}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">Be honest — this helps your plan, but it never counts as measured proficiency. It&apos;s fine to leave items unticked and come back later.</p>
            {!done && (
              <Button
                variant="secondary"
                onClick={async () => {
                  await progressRepo.completeStep(lesson, step.id);
                  log.ping();
                }}
              >
                <ClipboardCheck className="h-4 w-4" /> I&apos;ve done my self-check
              </Button>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
          <Button variant="ghost" onClick={() => go({ kind: "step", index: Math.max(0, view.index - 1) })} disabled={view.index === 0}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={() => void advance(view.index)} variant={(isExercise || step.kind === "self-check") && !done ? "secondary" : "primary"} data-testid="lesson-next">
            {(isExercise || step.kind === "self-check") && !done ? "Skip for now" : view.index === lesson.steps.length - 1 ? (lesson.quiz.length ? "Go to quiz" : "Finish") : "Next"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  } else if (view.kind === "quiz") {
    content = (
      <Card className="p-5 sm:p-7">
        <div className="mb-4 flex items-center gap-2">
          <Badge tone="accent">
            <MessageCircleQuestion className="h-3 w-3" /> Quiz
          </Badge>
          <span className="text-xs text-subtle">Pass mark {Math.round(lesson.passScore * 100)}%</span>
        </div>
        <LessonQuiz
          lesson={lesson}
          instrument={instrument}
          best={progress?.quizBest ?? null}
          onActivity={log.ping}
          onFinish={async (score, total, wrong) => {
            try {
              await progressRepo.recordQuiz(lesson, score, total, wrong);
            } catch {
              toast.error("Couldn't save your quiz result.");
            }
          }}
        />
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
          <Button variant="ghost" onClick={() => go({ kind: "step", index: lesson.steps.length - 1 })}>
            <ArrowLeft className="h-4 w-4" /> Back to steps
          </Button>
          <Button onClick={() => go({ kind: "done" })} data-testid="lesson-finish">
            Lesson summary <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  } else {
    const mastery = masteryStepIds(lesson);
    const status = progress?.status ?? "in-progress";
    const missingSteps = lesson.steps.filter((s) => !stepsDone.includes(s.id));
    const quizOk = !lesson.quiz.length || (progress?.quizBest ?? 0) >= lesson.passScore;
    content = (
      <Card className="p-5 sm:p-7" data-testid="lesson-summary">
        <div className="flex items-start gap-4">
          <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", status === "mastered" ? "bg-success-soft text-success" : status === "completed" ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted")}>
            {status === "mastered" ? <Trophy className="h-7 w-7" /> : status === "completed" ? <GraduationCap className="h-7 w-7" /> : <ListChecks className="h-7 w-7" />}
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{status === "mastered" ? "Lesson mastered!" : status === "completed" ? "Lesson completed" : "Almost there"}</h2>
            <p className="mt-1 text-muted">
              {status === "mastered"
                ? "You finished every step, passed the quiz and demonstrated the skill in the measured exercises."
                : status === "completed"
                  ? "You finished the steps and passed the quiz. Pass the mastery checks to show proficiency — you can do that any time."
                  : "Finish the remaining items below to complete this lesson."}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium">Completion</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li className="flex items-center gap-2">
                {missingSteps.length === 0 ? <CheckCircle2 className="h-4 w-4 text-success" /> : <span className="h-4 w-4 rounded-full border-2 border-border-strong" />}
                All steps ({lesson.steps.length - missingSteps.length}/{lesson.steps.length})
              </li>
              {lesson.quiz.length > 0 && (
                <li className="flex items-center gap-2">
                  {quizOk ? <CheckCircle2 className="h-4 w-4 text-success" /> : <span className="h-4 w-4 rounded-full border-2 border-border-strong" />}
                  Quiz {progress?.quizBest !== null && progress?.quizBest !== undefined ? `(best ${Math.round(progress.quizBest * 100)}%)` : "(not taken)"}
                </li>
              )}
            </ul>
            {missingSteps.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {missingSteps.map((s) => (
                  <button key={s.id} type="button" onClick={() => go({ kind: "step", index: lesson.steps.indexOf(s) })} className="rounded-lg bg-surface-2 px-2 py-1 text-xs hover:bg-surface-3">
                    {s.title}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium">Mastery checks (measured)</p>
            {mastery.length === 0 ? (
              <p className="mt-2 text-sm text-muted">This lesson has no measured mastery check.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {mastery.map((m) => {
                  const s = lesson.steps.find((x) => x.id === m.id)!;
                  const best = progress?.exerciseBest[m.id];
                  const ok = (best ?? 0) >= m.pass;
                  return (
                    <li key={m.id} className="flex items-center gap-2">
                      {ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <span className="h-4 w-4 rounded-full border-2 border-border-strong" />}
                      <button type="button" className="text-left hover:text-accent" onClick={() => go({ kind: "step", index: lesson.steps.indexOf(s) })}>
                        {s.title}
                      </button>
                      <span className="ml-auto text-xs tabular-nums text-muted">
                        {best !== undefined ? `${Math.round(best * 100)}%` : "—"} / {Math.round(m.pass * 100)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <Callout className="mt-5" title="How mastery works">
          <ul className="list-disc space-y-1 pl-4">
            {MASTERY_EXPLANATION.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Callout>

        <div className="mt-6 flex flex-wrap gap-2">
          {next ? (
            <Link href={`/lesson/${next.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover" data-testid="next-lesson">
              Next: {next.title} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link href="/learn" className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg">
              Back to curriculum
            </Link>
          )}
          <Button variant="secondary" onClick={() => go({ kind: "step", index: 0 })}>
            <RotateCcw className="h-4 w-4" /> Revise from the start
          </Button>
          <Link href="/dashboard" className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-muted hover:bg-surface-2">
            Dashboard
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {header}
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        {rail}
        <div className="min-w-0">{content}</div>
      </div>
    </div>
  );
}
