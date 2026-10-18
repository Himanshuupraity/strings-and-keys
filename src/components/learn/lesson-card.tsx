"use client";

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
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <Badge tone={s.tone} data-status={status}>
      <Icon className="h-3 w-3" aria-hidden />
      {s.label}
    </Badge>
  );
}

export function LessonCard({ view, highlight }: { view: LessonView; highlight?: boolean }) {
  const { lesson, status, unlocked, missing } = view;
  const done = status === "completed" || status === "mastered";
  const cta = !unlocked ? null : done ? { label: "Review", icon: RotateCcw } : status === "in-progress" ? { label: "Continue", icon: PlayCircle } : { label: "Start", icon: PlayCircle };

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={TRACK_TONE[lesson.track]} className="capitalize">{lesson.track}</Badge>
        {unlocked ? <StatusBadge status={status} /> : <Badge tone="neutral"><Lock className="h-3 w-3" aria-hidden /> Locked</Badge>}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted">
          <Clock className="h-3 w-3" aria-hidden /> {lesson.minutes} min
        </span>
      </div>
      <h4 className="mt-2.5 font-semibold leading-snug">{lesson.title}</h4>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{lesson.summary}</p>
      {view.quizBest !== null && <p className="mt-2 text-xs text-muted">Best quiz score: {Math.round(view.quizBest * 100)}%</p>}
      {!unlocked && missing.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Complete first:{" "}
          {missing.map((id, i) => {
            const pre = getLesson(id);
            return (
              <span key={id}>
                {i > 0 && ", "}
                {pre ? (
                  <Link href={`/lesson/${id}`} className="font-medium text-accent underline-offset-2 hover:underline">
                    {pre.title}
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
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          <cta.icon className="h-4 w-4" aria-hidden /> {cta.label}
        </span>
      )}
    </>
  );

  const cls = cn(
    "block h-full rounded-2xl border bg-surface p-4 shadow-card transition-all",
    unlocked ? "border-border hover:-translate-y-0.5 hover:border-accent/60" : "border-dashed border-border-strong opacity-80",
    highlight && "ring-2 ring-accent/50",
  );

  return unlocked ? (
    <Link href={`/lesson/${lesson.id}`} className={cls} data-testid={`lesson-card-${lesson.id}`} aria-label={`${lesson.title} — ${STATUS[status].label}`}>
      {body}
    </Link>
  ) : (
    <div className={cls} data-testid={`lesson-card-${lesson.id}`} aria-label={`${lesson.title} — locked`}>
      {body}
    </div>
  );
}
