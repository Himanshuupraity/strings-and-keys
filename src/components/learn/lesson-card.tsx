"use client";

import { lessonText, useLang, useT, useTx } from "@/lib/i18n";
import Link from "next/link";
import { CheckCircle2, Circle, Clock, Lock, PlayCircle, RotateCcw, Star } from "lucide-react";
import { getLesson } from "@/content/curriculum";
import { Badge, cn } from "@/components/ui";
import type { LessonView } from "./lesson-state";

const STATUS = {
  "not-started": { label: "Not started", tone: "neutral", icon: Circle },
  "in-progress": { label: "In progress", tone: "warn", icon: PlayCircle },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2 },
  mastered: { label: "Mastered", tone: "accent", icon: Star },
} as const;

const TRACK_TONE = { theory: "theory", guitar: "guitar", piano: "piano" } as const;

export function StatusBadge({ status }: { status: LessonView["status"] }) {
  const tx = useTx();
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <Badge tone={s.tone} data-status={status}>
      <Icon className="h-3 w-3" aria-hidden />
      {tx(s.label)}
    </Badge>
  );
}

export function LessonCard({ view, highlight }: { view: LessonView; highlight?: boolean }) {
  const t = useT();
  const tx = useTx();
  const lang = useLang();
  const { lesson, status, unlocked, missing } = view;
  const text = lessonText(lesson, lang);
  const done = status === "completed" || status === "mastered";
  const cta = !unlocked ? null : done ? { label: t("ui.review"), icon: RotateCcw } : status === "in-progress" ? { label: t("common.continue"), icon: PlayCircle } : { label: t("common.start"), icon: PlayCircle };

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={TRACK_TONE[lesson.track]} className="capitalize">{lesson.track}</Badge>
        {unlocked ? <StatusBadge status={status} /> : <Badge tone="neutral"><Lock className="h-3 w-3" aria-hidden /> {t("ui.locked")}</Badge>}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted">
          <Clock className="h-3 w-3" aria-hidden /> {lesson.minutes} min
        </span>
      </div>
      <h4 className="mt-2.5 font-semibold leading-snug">{text.title}</h4>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{text.summary}</p>
      {view.quizBest !== null && <p className="mt-2 text-xs text-muted">{t("ui.best_quiz_score", { pct: Math.round(view.quizBest * 100) })}</p>}
      {!unlocked && missing.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {t("ui.complete_first")}{" "}
          {missing.map((id, i) => {
            const pre = getLesson(id);
            return (
              <span key={id}>
                {i > 0 && ", "}
                {pre ? (
                  <Link href={`/lesson/${id}`} className="font-medium text-accent underline-offset-2 hover:underline">
                    {lessonText(pre, lang).title}
                  </Link>
                ) : (
                  <span className="font-medium">{id}</span>
                )}
              </span>
            );
          })}
        </p>
      )}
      {cta && (
        <span className={cn("mt-3 inline-flex items-center gap-1.5 text-sm font-medium", done ? "text-success" : "text-accent")}>
          <cta.icon className="h-4 w-4" aria-hidden /> {cta.label}
        </span>
      )}
    </>
  );

  const cls = cn(
    "block h-full rounded-2xl border bg-surface p-4 shadow-card transition-all",
    !unlocked
      ? "border-dashed border-border-strong opacity-80"
      : done
        ? "border-success/50 bg-[color-mix(in_oklab,var(--success)_10%,var(--surface))] hover:-translate-y-0.5 hover:border-success"
        : "border-border hover:-translate-y-0.5 hover:border-accent/60",
    highlight && "ring-2 ring-accent/50",
  );

  return unlocked ? (
    <Link href={`/lesson/${lesson.id}`} className={cls} data-testid={`lesson-card-${lesson.id}`} aria-label={`${text.title} — ${tx(STATUS[status].label)}`}>
      {body}
    </Link>
  ) : (
    <div className={cls} data-testid={`lesson-card-${lesson.id}`} aria-label={`${text.title} — ${t("lesson.lockedLabel")}`}>
      {body}
    </div>
  );
}
