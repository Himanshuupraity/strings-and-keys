"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, Guitar, Piano } from "lucide-react";
import { COURSES, LESSONS, lessonsForInstrument } from "@/content/curriculum";
import { usePrefs } from "@/hooks/use-prefs";
import { nextLesson } from "@/lib/progress/engine";
import { Button, Callout, Card, PageHeader, ProgressBar, Skeleton } from "@/components/ui";
import { useLearningData } from "./use-learning-data";
import { currentLevel, summarizeLevels } from "./lesson-state";
import { CompletionCriteria, LevelSection } from "./level-section";

export function CoursePage({ instrument }: { instrument: "guitar" | "piano" }) {
  const [prefs, setPrefs] = usePrefs();
  const { progress, placement, loading } = useLearningData();
  const lessons = useMemo(() => lessonsForInstrument(instrument), [instrument]);
  const levels = useMemo(() => summarizeLevels(lessons, progress, placement), [lessons, progress, placement]);
  const working = currentLevel(levels);
  const next = nextLesson(LESSONS, progress, [instrument, "theory"], placement);
  const done = levels.reduce((a, l) => a + l.done, 0);
  const total = levels.reduce((a, l) => a + l.total, 0);
  const Icon = instrument === "guitar" ? Guitar : Piano;
  const course = COURSES[instrument];

  return (
    <div>
      <Link href="/learn" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" /> All courses
      </Link>
      <PageHeader
        eyebrow={instrument === "guitar" ? "Guitar course" : "Piano & keyboard course"}
        title={course.title}
        description={`${course.description} Includes the shared music-theory lessons.`}
        actions={
          prefs.instrument !== instrument ? (
            <Button onClick={() => setPrefs({ instrument })}>
              <Icon className="h-4 w-4" /> Switch to {instrument} mode
            </Button>
          ) : next ? (
            <Link href={`/lesson/${next.id}`}>
              <Button>Continue: {next.title}</Button>
            </Link>
          ) : null
        }
      />
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className={instrument === "guitar" ? "flex h-11 w-11 items-center justify-center rounded-xl bg-guitar-soft text-guitar" : "flex h-11 w-11 items-center justify-center rounded-xl bg-piano-soft text-piano"}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-[200px] flex-1">
            <p className="text-sm font-medium">
              {done} of {total} lessons completed
            </p>
            {loading ? <Skeleton className="mt-2 h-2" /> : <ProgressBar className="mt-2" value={total ? done / total : 0} tone={instrument} label="Course progress" />}
          </div>
        </div>
        <div className="mt-4">
          <CompletionCriteria />
        </div>
      </Card>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : levels.length === 0 ? (
        <Callout title="No lessons yet">The curriculum for this course is still loading.</Callout>
      ) : (
        <div className="space-y-3">
          {levels.map((s) => (
            <LevelSection key={s.level} summary={s} defaultOpen={s.level === working} highlightId={next?.id} tone={instrument} />
          ))}
        </div>
      )}
    </div>
  );
}
