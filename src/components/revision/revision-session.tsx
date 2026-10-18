"use client";

import { useT, lessonText, useLang } from "@/lib/i18n";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Badge, Button, Card, CardBody, EmptyState, PageHeader, ProgressBar, Skeleton, cn } from "@/components/ui";
import { getLesson } from "@/content/curriculum";
import type { Lesson, LessonStep, QuizQuestion } from "@/content/types";
import { useData } from "@/hooks/use-data";
import { useHydrated, usePrefs } from "@/hooks/use-prefs";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { revisionRepo } from "@/lib/revision/repo";
import { addDays, isDue, localDay, review } from "@/lib/revision/schedule";
import type { RevisionItem } from "@/lib/storage/schemas";
import { ExerciseRenderer } from "@/components/lesson/exercises";
import { PlayExample } from "@/components/lesson/play-example";
import { VisualRenderer } from "@/components/lesson/visual";
import { resolveInstrument, type ExerciseOutcome, type Inst } from "@/components/lesson/utils";

type Resolved =
  | { item: RevisionItem; lesson: Lesson; kind: "quiz"; question: QuizQuestion }
  | { item: RevisionItem; lesson: Lesson; kind: "exercise"; step: Extract<LessonStep, { kind: "exercise" }> };

/** Turns stored items into renderable questions/exercises; drops items whose lesson content no longer exists. */
function resolve(items: RevisionItem[]): Resolved[] {
  return items.flatMap((item): Resolved[] => {
    const lesson = getLesson(item.lessonId);
    if (!lesson) return [];
    if (item.kind === "quiz") {
      const question = lesson.quiz.find((q) => q.id === item.refId);
      return question ? [{ item, lesson, kind: "quiz", question }] : [];
    }
    const step = lesson.steps.find((s) => s.id === item.refId);
    return step && step.kind === "exercise" ? [{ item, lesson, kind: "exercise", step }] : [];
  });
}

export function RevisionSession() {
  const t = useT();
  const lang = useLang();
  const hydrated = useHydrated();
  const [prefs] = usePrefs();
  const { data: all, loading } = useData(() => revisionRepo.all(), ["revision"], [] as RevisionItem[]);
  const log = usePracticeLog("Revision");
  // The queue is fixed when the session starts, so reviewed items don't jump around.
  const [queueIds, setQueueIds] = useState<string[] | null>(null);
  const [pos, setPos] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);

  const today = hydrated ? localDay() : "";
  const byId = useMemo(() => new Map(all.map((i) => [i.id, i])), [all]);
  const dueNow = useMemo(() => resolve(all.filter((i) => today && isDue(i, today)).sort((a, b) => a.due.localeCompare(b.due))), [all, today]);
  const upcoming = useMemo(() => {
    if (!today) return [];
    const end = addDays(today, 7);
    return all.filter((i) => i.due > today && i.due <= end).sort((a, b) => a.due.localeCompare(b.due));
  }, [all, today]);

  const queue = queueIds ? resolve(queueIds.map((id) => byId.get(id)).filter((x): x is RevisionItem => !!x)) : [];
  const current = queueIds ? queue[pos] : undefined;

  const answer = async (correct: boolean) => {
    if (!current) return;
    log.ping();
    // Re-read the latest copy (another tab/device may have changed it), then reschedule.
    const fresh = byId.get(current.item.id) ?? current.item;
    await revisionRepo.saveMany([review(fresh, correct)]);
    setResults((r) => [...r, correct]);
  };

  const next = () => setPos((p) => p + 1);

  if (!hydrated || loading) return <Skeleton className="h-80" />;

  const header = <PageHeader eyebrow={t("eyebrow.revision")} title={t("revise.heading")} description={t("ui.questions_and_exercises_you_missed_come_back_aft")} />;

  // Session finished
  if (queueIds && pos >= queue.length && queue.length > 0) {
    const right = results.filter(Boolean).length;
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <Card>
          <CardBody className="space-y-4 pt-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="text-xl font-semibold">{t("ui.revision_done", { right, n: results.length })}</p>
            <p className="text-sm text-muted">{t("ui.items_you_got_right_come_back_later_anything_you")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/dashboard" className="inline-flex h-11 items-center rounded-xl border border-border px-5 font-medium hover:bg-surface-2">{t("ui.back_to_dashboard")}</Link>
              {dueNow.length > 0 && <Button size="lg" onClick={() => { setQueueIds(dueNow.map((d) => d.item.id)); setPos(0); setResults([]); }}>{t("ui.revise_n_more", { n: dueNow.length })}</Button>}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Lobby
  if (!queueIds) {
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        {dueNow.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-success" />} title={t("ui.nothing_to_revise_today")} description={t("ui.when_you_miss_a_quiz_question_or_a_measured_exer")} action={<Link href="/learn" className="text-accent hover:underline">{t("welcome.continueLearning")}</Link>} />
        ) : (
          <Card>
            <CardBody className="space-y-4 pt-6">
              <p className="text-2xl font-semibold" data-testid="revision-due-count">{t("ui.n_to_revise_today", { n: dueNow.length })}</p>
              <ul className="space-y-1 text-sm text-muted">
                {dueNow.slice(0, 5).map((d) => (
                  <li key={d.item.id} className="truncate">• {lessonText(d.lesson, lang).title} — {d.kind === "quiz" ? t("ui.quiz_question_lc") : t("ui.exercise_lc")}</li>
                ))}
                {dueNow.length > 5 && <li>…and {dueNow.length - 5} more</li>}
              </ul>
              <Button size="lg" className="w-full sm:w-auto" onClick={() => { setQueueIds(dueNow.map((d) => d.item.id)); setPos(0); setResults([]); }} data-testid="revision-start">
                {t("ui.start_revision")}
              </Button>
            </CardBody>
          </Card>
        )}
        {upcoming.length > 0 && (
          <Card className="mt-6">
            <CardBody className="pt-5">
              <p className="mb-2 flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-accent" /> {t("ui.coming_up_next_7_days")}</p>
              <ul className="divide-y divide-border text-sm">
                {upcoming.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="truncate">{getLesson(i.lessonId)?.title ?? i.lessonId}</span>
                    <span className="shrink-0 text-muted">{new Date(i.due + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    );
  }

  if (!current) return <Skeleton className="h-80" />;
  const answered = results.length > pos;
  const inst: Inst = current.kind === "exercise" ? resolveInstrument("instrument" in current.step.exercise ? current.step.exercise.instrument : undefined, current.lesson, prefs.instrument) : prefs.instrument;

  return (
    <div className="mx-auto max-w-2xl">
      {header}
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>{pos + 1} of {queue.length}</span>
        <Badge tone={current.kind === "quiz" ? "theory" : "accent"}>{current.kind === "quiz" ? t("ui.quiz_question") : "Exercise"}</Badge>
      </div>
      <ProgressBar value={pos / queue.length} label={t("ui.revision_progress")} className="mb-4" />
      <Card>
        <CardBody className="space-y-4 pt-5">
          <p className="text-xs text-muted">{t("ui.from")} <Link href={`/lesson/${current.lesson.id}`} className="underline underline-offset-2">{current.lesson.title}</Link></p>
          {current.kind === "quiz" ? (
            <QuizCard key={current.item.id} question={current.question} instrument={inst} onAnswer={(c) => void answer(c)} />
          ) : (
            <div key={current.item.id} className="space-y-3">
              <h3 className="text-lg font-semibold">{current.step.title}</h3>
              <p className="text-sm text-muted">{current.step.body}</p>
              <ExerciseRenderer
                exercise={current.step.exercise}
                instrument={inst}
                track={current.lesson.track}
                passAccuracy={current.step.passAccuracy ?? 0.8}
                onActivity={log.ping}
                onComplete={(o: ExerciseOutcome) => !answered && void answer(o.measured && o.accuracy >= (current.step.passAccuracy ?? 0.8))}
              />
              {!answered && (
                <button type="button" onClick={() => void answer(false)} className="min-h-10 text-sm text-muted underline underline-offset-2">
                  {t("ui.skip_show_it_again_tomorrow")}
                </button>
              )}
            </div>
          )}
          {answered && (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className={cn("flex items-center gap-1.5 text-sm font-medium", results[pos] ? "text-success" : "text-warn")}>
                {results[pos] ? <CheckCircle2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                {results[pos] ? t("ui.nice_this_comes_back_later") : t("ui.no_problem_it_comes_back_tomorrow")}
              </p>
              <Button size="lg" onClick={next} data-testid="revision-next">{pos === queue.length - 1 ? "Finish" : "Next"}</Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function QuizCard({ question: q, instrument, onAnswer }: { question: QuizQuestion; instrument: Inst; onAnswer: (correct: boolean) => void }) {
  const t = useT();
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{q.question}</h3>
      {q.visual && <VisualRenderer visual={q.visual} />}
      {q.audio && <PlayExample audio={q.audio} instrument={instrument} />}
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={t("ui.answers")}>
        {q.options.map((o, k) => {
          const isAns = k === q.answer;
          return (
            <button
              key={k}
              type="button"
              disabled={picked !== null}
              data-testid={`revision-option-${k}`}
              onClick={() => {
                setPicked(k);
                onAnswer(k === q.answer);
              }}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-xl border px-4 py-2 text-left text-sm font-medium transition-colors",
                picked === null ? "border-border bg-surface hover:border-accent hover:bg-accent-soft" : isAns ? "border-success bg-success-soft text-success" : picked === k ? "border-danger bg-danger-soft text-danger" : "border-border opacity-60",
              )}
            >
              {picked !== null && isAns && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {picked === k && !isAns && <XCircle className="h-4 w-4 shrink-0" />}
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && <p className="text-sm text-muted">{q.explanation}</p>}
    </div>
  );
}
