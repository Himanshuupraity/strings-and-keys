import type { Lesson, Level } from "@/content/types";
import { isDone, isUnlocked } from "@/lib/progress/engine";
import type { LessonProgress, LessonStatus, Track } from "@/lib/storage/schemas";

export type Placement = Partial<Record<Track, number>>;

export interface LessonView {
  lesson: Lesson;
  status: LessonStatus;
  unlocked: boolean;
  /** Prerequisites not yet completed (only meaningful when locked). */
  missing: string[];
  quizBest: number | null;
}

export function lessonView(lesson: Lesson, progress: Record<string, LessonProgress>, placement?: Placement): LessonView {
  const p = progress[lesson.id];
  const status = p?.status ?? "not-started";
  // Revision is always allowed for anything already completed or started.
  const unlocked = isDone(p) || status === "in-progress" || isUnlocked(lesson, progress, placement);
  return {
    lesson,
    status,
    unlocked,
    missing: unlocked ? [] : lesson.prerequisites.filter((id) => !isDone(progress[id])),
    quizBest: p?.quizBest ?? null,
  };
}

export interface LevelSummary {
  level: Level;
  views: LessonView[];
  done: number;
  mastered: number;
  total: number;
  complete: boolean;
  allMastered: boolean;
}

export function summarizeLevels(lessons: Lesson[], progress: Record<string, LessonProgress>, placement?: Placement): LevelSummary[] {
  const map = new Map<Level, LessonView[]>();
  for (const l of [...lessons].sort((a, b) => a.level - b.level || a.order - b.order || a.track.localeCompare(b.track))) {
    map.set(l.level, [...(map.get(l.level) ?? []), lessonView(l, progress, placement)]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, views]) => {
      const done = views.filter((v) => v.status === "completed" || v.status === "mastered").length;
      const mastered = views.filter((v) => v.status === "mastered").length;
      return { level, views, done, mastered, total: views.length, complete: views.length > 0 && done === views.length, allMastered: views.length > 0 && mastered === views.length };
    });
}

/** The level a student is "working on": first incomplete level. */
export function currentLevel(levels: LevelSummary[]): Level | undefined {
  return levels.find((l) => !l.complete)?.level ?? levels.at(-1)?.level;
}
