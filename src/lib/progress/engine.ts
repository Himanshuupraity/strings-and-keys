import type { Lesson } from "@/content/types";
import type { ExerciseResult, LessonProgress, PracticeSession, Track } from "@/lib/storage/schemas";

/**
 * Mastery rules (shown to the student on the Progress page):
 *  - COMPLETED: every step done AND quiz score ≥ lesson.passScore.
 *  - MASTERED (demonstrated proficiency): completed AND every exercise flagged `mastery`
 *    was passed with measured input (virtual instrument, MIDI or microphone) at its pass accuracy.
 *    Self-assessment checklists never count towards mastery.
 *  - Opening a lesson only marks it IN-PROGRESS.
 */
export const MASTERY_EXPLANATION = [
  "Opening a lesson marks it as in progress — nothing more.",
  "A lesson is completed when you finish every step and pass its quiz.",
  "A lesson is mastered only when you also pass its measured exercises (played on the virtual instrument, a MIDI keyboard or your real instrument through the microphone).",
  "Self-check items (posture, finger pressure) are your own honest assessment — the app can't observe them and never counts them as measured proficiency.",
  "You can retry quizzes and exercises as many times as you like; your best result counts.",
];

export function emptyProgress(lesson: Pick<Lesson, "id" | "track">): LessonProgress {
  return {
    lessonId: lesson.id,
    track: lesson.track,
    status: "not-started",
    stepsDone: [],
    quizBest: null,
    quizAttempts: 0,
    exerciseBest: {},
    startedAt: null,
    completedAt: null,
    masteredAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function masteryStepIds(lesson: Lesson): { id: string; pass: number }[] {
  return lesson.steps.flatMap((s) => (s.kind === "exercise" && s.mastery ? [{ id: s.id, pass: s.passAccuracy ?? 0.8 }] : []));
}

/** Recompute status from evidence. Never downgrades a completed lesson. */
export function computeStatus(lesson: Lesson, p: LessonProgress, now = new Date()): LessonProgress {
  const allSteps = lesson.steps.every((s) => p.stepsDone.includes(s.id));
  const quizOk = lesson.quiz.length === 0 || (p.quizBest ?? 0) >= lesson.passScore;
  const completed = allSteps && quizOk;
  const mastery = masteryStepIds(lesson);
  const mastered = completed && mastery.length > 0 && mastery.every((m) => (p.exerciseBest[m.id] ?? 0) >= m.pass);
  const iso = now.toISOString();
  const next: LessonProgress = { ...p, updatedAt: iso };
  if (mastered) {
    next.status = "mastered";
    next.completedAt ??= iso;
    next.masteredAt ??= iso;
  } else if (completed || p.status === "completed" || p.status === "mastered") {
    next.status = p.status === "mastered" ? "mastered" : "completed";
    next.completedAt ??= iso;
  } else if (p.stepsDone.length > 0 || p.quizAttempts > 0 || p.startedAt) {
    next.status = "in-progress";
    next.startedAt ??= iso;
  }
  return next;
}

export function isDone(p?: LessonProgress): boolean {
  return p?.status === "completed" || p?.status === "mastered";
}

/**
 * A lesson is unlocked when all prerequisites are completed, OR when the diagnostic placement
 * put the student at/above this lesson's level for its track. Revision is always allowed.
 */
export function isUnlocked(lesson: Lesson, progress: Record<string, LessonProgress>, placement?: Partial<Record<Track, number>>): boolean {
  if (lesson.prerequisites.length === 0) return true;
  if (placement && (placement[lesson.track] ?? 0) > lesson.level) return true;
  return lesson.prerequisites.every((id) => isDone(progress[id]));
}

export function nextLesson(lessons: Lesson[], progress: Record<string, LessonProgress>, tracks: Track[], placement?: Partial<Record<Track, number>>): Lesson | undefined {
  const ordered = lessons.filter((l) => tracks.includes(l.track)).sort((a, b) => a.level - b.level || a.order - b.order);
  return (
    ordered.find((l) => progress[l.id]?.status === "in-progress" && isUnlocked(l, progress, placement)) ??
    ordered.find((l) => !isDone(progress[l.id]) && isUnlocked(l, progress, placement))
  );
}

/* ---------------- Practice statistics ---------------- */

export function dayKey(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Consecutive days (ending today or yesterday) with at least one practice session. */
export function practiceStreak(sessions: Pick<PracticeSession, "startedAt">[], today = new Date()): number {
  const days = new Set(sessions.map((s) => dayKey(s.startedAt)));
  const cursor = new Date(today);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function weeklyMinutes(sessions: PracticeSession[], today = new Date()): { day: string; label: string; guitar: number; piano: number }[] {
  const out: { day: string; label: string; guitar: number; piano: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push({ day: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: "short" }), guitar: 0, piano: 0 });
  }
  for (const s of sessions) {
    const row = out.find((r) => r.day === dayKey(s.startedAt));
    if (row) row[s.instrument] += Math.round((s.durationSec / 60) * 10) / 10;
  }
  return out;
}

export function totalMinutes(sessions: PracticeSession[], instrument?: "guitar" | "piano"): number {
  return Math.round(sessions.filter((s) => !instrument || s.instrument === instrument).reduce((a, s) => a + s.durationSec, 0) / 60);
}

/** Skills where measured exercise accuracy is consistently below 70% → recommended revision. */
export function weakSkills(results: ExerciseResult[], min = 2): { skill: string; accuracy: number; attempts: number }[] {
  const by = new Map<string, { sum: number; n: number }>();
  for (const r of results) {
    if (!r.measured || !r.skill) continue;
    const e = by.get(r.skill) ?? { sum: 0, n: 0 };
    e.sum += r.accuracy;
    e.n += 1;
    by.set(r.skill, e);
  }
  return [...by.entries()]
    .filter(([, v]) => v.n >= min && v.sum / v.n < 0.7)
    .map(([skill, v]) => ({ skill, accuracy: v.sum / v.n, attempts: v.n }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

/** Build a short-session practice plan (beginners: never > 45 min without breaks). */
export function practicePlan(minutes: number): { label: string; minutes: number; kind: "warmup" | "learn" | "exercise" | "apply" | "recap" | "break" }[] {
  const m = Math.max(5, Math.min(minutes, 90));
  const blocks: { label: string; minutes: number; kind: "warmup" | "learn" | "exercise" | "apply" | "recap" | "break" }[] = [];
  const r = (x: number) => Math.max(1, Math.round(x));
  const core = (len: number) => [
    { label: "Warm-up", minutes: r(len * 0.15), kind: "warmup" as const },
    { label: "Learn one concept", minutes: r(len * 0.25), kind: "learn" as const },
    { label: "Guided exercise", minutes: r(len * 0.25), kind: "exercise" as const },
    { label: "Song or musical application", minutes: r(len * 0.25), kind: "apply" as const },
    { label: "Recap & self-assessment", minutes: r(len * 0.1), kind: "recap" as const },
  ];
  if (m <= 30) return core(m);
  // Split into chunks of ~25 minutes with 5-minute breaks.
  let left = m;
  while (left > 0) {
    const chunk = Math.min(25, left);
    blocks.push(...core(chunk));
    left -= chunk;
    if (left > 5) {
      blocks.push({ label: "Break — stretch your hands and wrists", minutes: 5, kind: "break" });
      left -= 5;
    }
  }
  return blocks;
}
