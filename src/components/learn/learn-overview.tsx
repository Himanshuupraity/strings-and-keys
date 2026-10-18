"use client";

import { useT, useTx } from "@/lib/i18n";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, ClipboardCheck, Guitar, Music2, Piano, Sparkles } from "lucide-react";
import { COURSES, LESSONS, lessonsForInstrument, lessonsForTrack } from "@/content/curriculum";
import { usePrefs } from "@/hooks/use-prefs";
import { nextLesson, MASTERY_EXPLANATION } from "@/lib/progress/engine";
import type { Track } from "@/lib/storage/schemas";
import { Badge, Button, Callout, Card, PageHeader, ProgressBar, Segmented, Skeleton, cn } from "@/components/ui";
import { useLearningData } from "./use-learning-data";
import { currentLevel, summarizeLevels } from "./lesson-state";
import { CompletionCriteria, LevelSection } from "./level-section";
import { LessonCard } from "./lesson-card";
import { lessonView } from "./lesson-state";

const TRACK_META: Record<Track, { icon: typeof Guitar; tone: "guitar" | "piano" | "theory"; href: string; iconCls: string; ringCls: string }> = {
  guitar: { icon: Guitar, tone: "guitar", href: "/learn/guitar", iconCls: "bg-guitar-soft text-guitar", ringCls: "ring-2 ring-guitar" },
  piano: { icon: Piano, tone: "piano", href: "/learn/piano", iconCls: "bg-piano-soft text-piano", ringCls: "ring-2 ring-piano" },
  theory: { icon: Music2, tone: "theory", href: "/learn#map", iconCls: "bg-theory-soft text-theory", ringCls: "ring-2 ring-theory" },
};

export function LearnOverview() {
  const t = useT();
  const tx = useTx();
  const tl = t;
  const [prefs] = usePrefs();
  const { progress, placement, profile, loading } = useLearningData();
  const [scope, setScope] = useState<"path" | "all">("path");
  const instrument = prefs.instrument;

  const lessons = useMemo(() => (scope === "path" ? lessonsForInstrument(instrument) : LESSONS), [scope, instrument]);
  const levels = useMemo(() => summarizeLevels(lessons, progress, placement), [lessons, progress, placement]);
  const working = currentLevel(levels);
  const next = nextLesson(LESSONS, progress, [instrument, "theory"], placement);

  return (
    <div>
      <PageHeader
        eyebrow={t("learn.eyebrow")}
        title={t("learn.title")}
        description={t("ui.learn_desc")}
        actions={
          <Link href="/learn/diagnostic">
            <Button variant="secondary">
              <ClipboardCheck className="h-4 w-4" /> {t("ui.placement_quiz")}
            </Button>
          </Link>
        }
      />

      {/* Courses */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["guitar", "piano", "theory"] as Track[]).map((t) => {
          const meta = TRACK_META[t];
          const trackLessons = lessonsForTrack(t);
          const done = trackLessons.filter((l) => ["completed", "mastered"].includes(progress[l.id]?.status ?? "")).length;
          const active = t === instrument;
          const Icon = meta.icon;
          return (
            <Card key={t} className={cn("p-5", active && meta.ringCls)} data-testid={`course-${t}`}>
              <div className="flex items-start justify-between gap-3">
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", meta.iconCls)}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {active && <Badge tone={meta.tone}>{tl("ui.your_current_mode")}</Badge>}
                {t === "theory" && <Badge tone="theory">{tl("ui.shared")}</Badge>}
              </div>
              <h3 className="mt-3 font-semibold">{tx(COURSES[t].title)}</h3>
              <p className="mt-1 text-sm text-muted">{tx(COURSES[t].description)}</p>
              <div className="mt-4 flex items-center gap-3">
                {loading ? <Skeleton className="h-2 flex-1" /> : <ProgressBar value={trackLessons.length ? done / trackLessons.length : 0} tone={meta.tone} label={`${t} progress`} />}
                <span className="whitespace-nowrap text-xs text-muted">{done}/{trackLessons.length}</span>
              </div>
              {t !== "theory" && (
                <Link href={meta.href} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                  {tl("ui.open_course")} <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </Card>
          );
        })}
      </div>

      {/* Next + diagnostic */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent">
            <Sparkles className="h-4 w-4" /> {t("dash.recommended")}
          </div>
          {loading ? <Skeleton className="h-28" /> : next ? <LessonCard view={lessonView(next, progress, placement)} highlight /> : <p className="text-sm text-muted">{t("ui.you_ve_completed_everything_available_on_this_pa")}</p>}
        </Card>
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ClipboardCheck className="h-4 w-4 text-accent" /> {t("ui.not_a_total_beginner")}
          </div>
          <p className="text-sm text-muted">{t("ui.take_a_short_placement_quiz_it_unlocks_earlier_l")}</p>
          {profile && (profile.placement.theory || profile.placement.guitar || profile.placement.piano) ? (
            <p className="mt-2 text-xs text-muted">
              {t("ui.current_placement", { theory: profile.placement.theory, guitar: profile.placement.guitar, piano: profile.placement.piano })}
            </p>
          ) : null}
          <Link href="/learn/diagnostic" className="mt-3 inline-block">
            <Button size="sm">
              {t("ui.take_the_quiz")} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </Card>
      </div>

      {/* Level map */}
      <section id="map" className="mt-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <BookOpen className="h-5 w-5 text-accent" /> {t("ui.level_map")}
            </h2>
            <CompletionCriteria />
          </div>
          <Segmented
            label={t("ui.which_lessons_to_show")}
            size="sm"
            value={scope}
            onChange={setScope}
            options={[
              { value: "path", label: `My ${instrument} path` },
              { value: "all", label: t("ui.all_tracks") },
            ]}
          />
        </div>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : levels.length === 0 ? (
          <Callout title={t("ui.lessons_are_loading_into_the_curriculum")}>{t("ui.no_lessons_found_for_this_path_yet")}</Callout>
        ) : (
          <div className="space-y-3">
            {levels.map((s) => (
              <LevelSection key={s.level} summary={s} defaultOpen={s.level === working} highlightId={next?.id} tone={instrument} />
            ))}
          </div>
        )}
        <details className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium">{t("ui.how_completion_and_mastery_work")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {MASTERY_EXPLANATION.map((m) => (
              <li key={m}>{tx(m)}</li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
