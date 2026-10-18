import type { Lesson } from "@/content/types";
import { computeStatus, emptyProgress } from "@/lib/progress/engine";
import type { CollectionName } from "./adapter";
import { ALL_COLLECTIONS, ensureMigrated, getAdapter, notify, uid } from "./db";
import {
  ChordDrillSchema,
  CoachMessageSchema,
  DEFAULT_GOALS,
  ExerciseResultSchema,
  ExportSchema,
  GoalsSchema,
  LessonProgressSchema,
  PracticeSessionSchema,
  ProfileSchema,
  QuizAttemptSchema,
  SCHEMA_VERSION,
  SongProgressSchema,
  TranspositionSchema,
  VideoStateSchema,
  type ChordDrillResult,
  type CoachMessage,
  type ExerciseResult,
  type ExportBundle,
  type Goals,
  type LessonProgress,
  type PracticeSession,
  type Profile,
  type QuizAttempt,
  type SongProgress,
  type Transposition,
  type VideoState,
} from "./schemas";
import { loadPrefs, savePrefs } from "./prefs";
import type { z } from "zod";

/** Validated list: drops malformed rows instead of crashing. */
async function listValid<S extends z.ZodTypeAny>(c: CollectionName, schema: S): Promise<z.infer<S>[]> {
  await ensureMigrated();
  const rows = await getAdapter().list<unknown>(c);
  const out: z.infer<S>[] = [];
  for (const r of rows) {
    const p = schema.safeParse(r.value);
    if (p.success) out.push(p.data);
  }
  return out;
}

async function getValid<S extends z.ZodTypeAny>(c: CollectionName, key: string, schema: S): Promise<z.infer<S> | undefined> {
  await ensureMigrated();
  const v = await getAdapter().get<unknown>(c, key);
  if (v === undefined) return undefined;
  const p = schema.safeParse(v);
  return p.success ? p.data : undefined;
}

async function put<T>(c: CollectionName, key: string, value: T) {
  await ensureMigrated();
  await getAdapter().set(c, key, value);
  notify(c);
}

const byDateDesc = <T extends { date?: string; startedAt?: string }>(a: T, b: T) =>
  (b.date ?? b.startedAt ?? "").localeCompare(a.date ?? a.startedAt ?? "");

/* ---------------- Profile & goals ---------------- */

export const profileRepo = {
  get: () => getValid("profile", "me", ProfileSchema),
  save: (p: Partial<Profile>) => put("profile", "me", ProfileSchema.parse(p)),
};

export const goalsRepo = {
  get: async (): Promise<Goals> => (await getValid("goals", "me", GoalsSchema)) ?? DEFAULT_GOALS,
  save: (g: Partial<Goals>) => put("goals", "me", GoalsSchema.parse(g)),
};

/* ---------------- Lesson progress ---------------- */

export const progressRepo = {
  all: async (): Promise<Record<string, LessonProgress>> => {
    const rows = await listValid("lessonProgress", LessonProgressSchema);
    return Object.fromEntries(rows.map((r) => [r.lessonId, r]));
  },
  get: (id: string) => getValid("lessonProgress", id, LessonProgressSchema),
  async mutate(lesson: Lesson, fn: (p: LessonProgress) => LessonProgress): Promise<LessonProgress> {
    const prev = (await this.get(lesson.id)) ?? emptyProgress(lesson);
    const next = computeStatus(lesson, fn(prev));
    await put("lessonProgress", lesson.id, next);
    return next;
  },
  open(lesson: Lesson) {
    return this.mutate(lesson, (p) => ({ ...p, startedAt: p.startedAt ?? new Date().toISOString() }));
  },
  completeStep(lesson: Lesson, stepId: string) {
    return this.mutate(lesson, (p) => ({ ...p, stepsDone: Array.from(new Set([...p.stepsDone, stepId])) }));
  },
  recordExercise(lesson: Lesson, stepId: string, accuracy: number, markDone: boolean) {
    return this.mutate(lesson, (p) => ({
      ...p,
      exerciseBest: { ...p.exerciseBest, [stepId]: Math.max(p.exerciseBest[stepId] ?? 0, accuracy) },
      stepsDone: markDone ? Array.from(new Set([...p.stepsDone, stepId])) : p.stepsDone,
    }));
  },
  async recordQuiz(lesson: Lesson, score: number, total: number, wrongQuestionIds: string[]) {
    const attempt: QuizAttempt = { id: uid("q_"), lessonId: lesson.id, date: new Date().toISOString(), score, total, wrongQuestionIds };
    await put("quizAttempts", attempt.id, QuizAttemptSchema.parse(attempt));
    const frac = total ? score / total : 1;
    return this.mutate(lesson, (p) => ({ ...p, quizAttempts: p.quizAttempts + 1, quizBest: Math.max(p.quizBest ?? 0, frac) }));
  },
  reset: async (id: string) => {
    await getAdapter().remove("lessonProgress", id);
    notify("lessonProgress");
  },
};

export const quizRepo = {
  list: async () => (await listValid("quizAttempts", QuizAttemptSchema)).sort(byDateDesc),
};

/* ---------------- Practice ---------------- */

export const practiceRepo = {
  list: async (): Promise<PracticeSession[]> => (await listValid("practiceSessions", PracticeSessionSchema)).sort(byDateDesc),
  add: async (s: Omit<PracticeSession, "id"> & { id?: string }) => {
    const row = PracticeSessionSchema.parse({ ...s, id: s.id ?? uid("ps_") });
    await put("practiceSessions", row.id, row);
    return row;
  },
  remove: async (id: string) => {
    await getAdapter().remove("practiceSessions", id);
    notify("practiceSessions");
  },
};

export const exerciseRepo = {
  list: async (): Promise<ExerciseResult[]> => (await listValid("exerciseResults", ExerciseResultSchema)).sort(byDateDesc),
  add: async (r: Omit<ExerciseResult, "id" | "date"> & { date?: string }) => {
    const row = ExerciseResultSchema.parse({ ...r, id: uid("ex_"), date: r.date ?? new Date().toISOString() });
    await put("exerciseResults", row.id, row);
    return row;
  },
};

export const drillRepo = {
  list: async (): Promise<ChordDrillResult[]> => (await listValid("chordDrills", ChordDrillSchema)).sort(byDateDesc),
  add: async (r: Omit<ChordDrillResult, "id" | "date"> & { date?: string }) => {
    const row = ChordDrillSchema.parse({ ...r, id: uid("cd_"), date: r.date ?? new Date().toISOString() });
    await put("chordDrills", row.id, row);
    return row;
  },
};

/* ---------------- Songs, videos, transpositions, coach ---------------- */

export const songRepo = {
  list: () => listValid("songProgress", SongProgressSchema),
  get: (songId: string, instrument: string) => getValid("songProgress", `${songId}:${instrument}`, SongProgressSchema),
  upsert: async (songId: string, instrument: "guitar" | "piano", fn: (p: SongProgress) => SongProgress) => {
    const prev = (await songRepo.get(songId, instrument)) ?? { songId, instrument, saved: false, sectionsPracticed: [], minutes: 0 };
    const next = SongProgressSchema.parse(fn(prev));
    await put("songProgress", `${songId}:${instrument}`, next);
    return next;
  },
};

export const videoRepo = {
  list: () => listValid("videoState", VideoStateSchema),
  set: async (videoId: string, patch: Partial<Pick<VideoState, "favorite" | "watched">>) => {
    const prev = (await getValid("videoState", videoId, VideoStateSchema)) ?? { videoId, favorite: false, watched: false, updatedAt: "" };
    const next = VideoStateSchema.parse({ ...prev, ...patch, updatedAt: new Date().toISOString() });
    await put("videoState", videoId, next);
    return next;
  },
};

export const transpositionRepo = {
  list: async () => (await listValid("transpositions", TranspositionSchema)).sort(byDateDesc),
  add: async (t: Omit<Transposition, "id" | "date">) => {
    const row = TranspositionSchema.parse({ ...t, id: uid("tr_"), date: new Date().toISOString() });
    await put("transpositions", row.id, row);
    // Keep the 20 most recent.
    const all = await transpositionRepo.list();
    await Promise.all(all.slice(20).map((r) => getAdapter().remove("transpositions", r.id)));
    return row;
  },
};

export const coachRepo = {
  list: async (): Promise<CoachMessage[]> => (await listValid("coachHistory", CoachMessageSchema)).sort((a, b) => a.date.localeCompare(b.date)),
  add: async (m: Omit<CoachMessage, "id" | "date">) => {
    const row = CoachMessageSchema.parse({ ...m, id: uid("cm_"), date: new Date().toISOString() });
    await put("coachHistory", row.id, row);
    return row;
  },
  clear: async () => {
    await getAdapter().clear("coachHistory");
    notify("coachHistory");
  },
};

/* ---------------- Export / import (backup & account migration) ---------------- */

export async function exportAll(): Promise<ExportBundle> {
  await ensureMigrated();
  const collections: ExportBundle["collections"] = {};
  for (const c of ALL_COLLECTIONS) collections[c] = await getAdapter().list(c);
  return { app: "melody-masters", version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), prefs: loadPrefs(), collections };
}

export interface ImportPlan {
  added: number;
  conflicts: { collection: string; key: string }[];
  identical: number;
}

/** Dry-run: tells the user exactly what an import would change before anything is written. */
export async function planImport(bundle: unknown): Promise<ImportPlan> {
  const b = ExportSchema.parse(bundle);
  const plan: ImportPlan = { added: 0, conflicts: [], identical: 0 };
  for (const [c, rows] of Object.entries(b.collections)) {
    if (!ALL_COLLECTIONS.includes(c as CollectionName)) continue;
    for (const r of rows) {
      const existing = await getAdapter().get(c as CollectionName, r.key);
      if (existing === undefined) plan.added++;
      else if (JSON.stringify(existing) === JSON.stringify(r.value)) plan.identical++;
      else plan.conflicts.push({ collection: c, key: r.key });
    }
  }
  return plan;
}

/** Apply an import. Conflicts are resolved by `strategy`; local data is never silently overwritten. */
export async function applyImport(bundle: unknown, strategy: "keep-local" | "keep-imported", importPrefs = false) {
  const b = ExportSchema.parse(bundle);
  for (const [c, rows] of Object.entries(b.collections)) {
    if (!ALL_COLLECTIONS.includes(c as CollectionName)) continue;
    for (const r of rows) {
      const existing = await getAdapter().get(c as CollectionName, r.key);
      if (existing !== undefined && strategy === "keep-local") continue;
      await getAdapter().set(c as CollectionName, r.key, r.value);
    }
    notify(c as CollectionName);
  }
  if (importPrefs && b.prefs && typeof b.prefs === "object") savePrefs(b.prefs as never);
}

export async function resetAllData() {
  for (const c of ALL_COLLECTIONS) {
    await getAdapter().clear(c);
    notify(c);
  }
}
