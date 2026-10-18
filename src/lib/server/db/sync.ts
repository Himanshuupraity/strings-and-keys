import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type {
  ChordDrillResult,
  CoachMessage,
  ExerciseResult,
  LessonProgress,
  PracticeSession,
  QuizAttempt,
  SongProgress,
  Transposition,
  VideoState,
} from "@/lib/storage/schemas";
import { emptyBundle, statusFromDb, statusToDb, type CleanBundle } from "./sync-mapping";

/** Server-side read/write of a user's synced data, in the device's ExportBundle row format. */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const date = (s: string | null | undefined) => (s ? new Date(s) : null);
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

export async function readServerBundle(db: PrismaClient, userId: string): Promise<{ bundle: CleanBundle; prefs: unknown }> {
  const where = { userId };
  const [pref, lessons, attempts, practice, drills, songs, songProgress, videos, transpositions, coach] = await Promise.all([
    db.userPreferences.findUnique({ where }),
    db.lessonCompletion.findMany({ where }),
    db.assessmentAttempt.findMany({ where }),
    db.practiceSession.findMany({ where }),
    db.chordDrillResult.findMany({ where }),
    db.savedSong.findMany({ where }),
    db.songProgress.findMany({ where }),
    db.savedVideo.findMany({ where }),
    db.transposition.findMany({ where }),
    db.coachMessage.findMany({ where }),
  ]);
  const b = emptyBundle();
  if (pref?.profile) b.profile.push({ key: "me", value: pref.profile });
  if (pref?.goals) b.goals.push({ key: "me", value: pref.goals });
  b.lessonProgress = lessons.map((l) => ({
    key: l.lessonId,
    value: {
      lessonId: l.lessonId,
      track: l.track,
      status: statusFromDb(l.status) as LessonProgress["status"],
      stepsDone: l.stepsDone,
      quizBest: l.quizBest,
      quizAttempts: l.quizAttempts,
      exerciseBest: (l.exerciseBest ?? {}) as Record<string, number>,
      startedAt: iso(l.startedAt),
      completedAt: iso(l.completedAt),
      masteredAt: iso(l.masteredAt),
      updatedAt: l.updatedAt.toISOString(),
    } satisfies LessonProgress,
  }));
  for (const a of attempts) {
    if (a.kind === "quiz") {
      b.quizAttempts.push({
        key: a.id,
        value: { id: a.id, lessonId: a.lessonId ?? "", date: a.date.toISOString(), score: a.correct, total: a.total, wrongQuestionIds: a.wrongQuestionIds } satisfies QuizAttempt,
      });
    } else {
      b.exerciseResults.push({
        key: a.id,
        value: {
          id: a.id,
          date: a.date.toISOString(),
          instrument: (a.instrument ?? "theory") as ExerciseResult["instrument"],
          exerciseId: a.exerciseId ?? "",
          lessonId: opt(a.lessonId),
          skill: opt(a.skill),
          input: (a.input ?? "virtual") as ExerciseResult["input"],
          correct: a.correct,
          total: a.total,
          accuracy: a.accuracy ?? 0,
          timingErrorMs: opt(a.timingErrorMs),
          measured: a.measured,
          details: opt(a.details),
        } satisfies ExerciseResult,
      });
    }
  }
  b.practiceSessions = practice.map((p) => ({
    key: p.id,
    value: {
      id: p.id,
      instrument: p.instrument,
      activity: p.activity,
      lessonId: opt(p.lessonId),
      startedAt: p.startedAt.toISOString(),
      endedAt: p.endedAt.toISOString(),
      durationSec: p.durationSec,
      notes: opt(p.notes),
    } satisfies PracticeSession,
  }));
  b.chordDrills = drills.map((d) => ({
    key: d.id,
    value: {
      id: d.id,
      date: d.date.toISOString(),
      pair: [d.chordA, d.chordB],
      durationSec: d.durationSec,
      transitions: d.transitions,
      mode: d.mode as ChordDrillResult["mode"],
      confirmedByAudio: opt(d.confirmedByAudio),
      confirmedManually: opt(d.confirmedManually),
      cleanRate: opt(d.cleanRate),
      untimed: opt(d.untimed),
    } satisfies ChordDrillResult,
  }));
  b.savedSongs = songs.map((s) => ({ key: s.key, value: s.data }));
  b.songProgress = songProgress.map((s) => ({
    key: `${s.songId}:${s.instrument}`,
    value: {
      songId: s.songId,
      instrument: s.instrument,
      saved: s.saved,
      sectionsPracticed: s.sectionsPracticed,
      bestTempo: opt(s.bestTempo),
      minutes: s.minutes,
      lastPracticed: opt(iso(s.lastPracticed)),
    } satisfies SongProgress,
  }));
  b.videoState = videos.map((v) => ({
    key: v.videoId,
    value: { videoId: v.videoId, favorite: v.favorite, watched: v.watched, updatedAt: v.updatedAt.toISOString() } satisfies VideoState,
  }));
  b.transpositions = transpositions.map((t) => ({
    key: t.id,
    value: { id: t.id, date: t.date.toISOString(), progression: t.progression, originalKey: t.originalKey, capo: t.capo, shapes: t.shapes, label: opt(t.label) } satisfies Transposition,
  }));
  b.coachHistory = coach.map((m) => ({
    key: m.id,
    value: { id: m.id, role: m.role as CoachMessage["role"], content: m.content, date: m.date.toISOString(), source: opt(m.source) as CoachMessage["source"] } satisfies CoachMessage,
  }));
  return { bundle: b, prefs: pref?.prefs ?? null };
}

/** Upsert validated rows (already filtered by strategy). Runs in one transaction. */
export async function writeRows(db: PrismaClient, userId: string, rows: CleanBundle, prefs: Record<string, unknown> | null): Promise<number> {
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const json = (v: unknown) => v as Prisma.InputJsonValue;

  const profile = rows.profile[0]?.value;
  const goals = rows.goals[0]?.value;
  if (profile || goals || prefs) {
    const data = { ...(profile ? { profile: json(profile) } : {}), ...(goals ? { goals: json(goals) } : {}), ...(prefs ? { prefs: json(prefs) } : {}) };
    ops.push(db.userPreferences.upsert({ where: { userId }, create: { userId, ...data }, update: data }));
  }
  for (const { value } of rows.lessonProgress) {
    const l = value as LessonProgress;
    const data = {
      track: l.track,
      status: statusToDb(l.status),
      stepsDone: l.stepsDone,
      quizBest: l.quizBest,
      quizAttempts: l.quizAttempts,
      exerciseBest: json(l.exerciseBest),
      startedAt: date(l.startedAt),
      completedAt: date(l.completedAt),
      masteredAt: date(l.masteredAt),
      updatedAt: new Date(l.updatedAt),
    };
    ops.push(db.lessonCompletion.upsert({ where: { userId_lessonId: { userId, lessonId: l.lessonId } }, create: { userId, lessonId: l.lessonId, ...data }, update: data }));
  }
  for (const { value } of rows.quizAttempts) {
    const q = value as QuizAttempt;
    const data = { kind: "quiz" as const, lessonId: q.lessonId, date: new Date(q.date), correct: q.score, total: q.total, wrongQuestionIds: q.wrongQuestionIds, measured: true };
    ops.push(db.assessmentAttempt.upsert({ where: { userId_id: { userId, id: q.id } }, create: { userId, id: q.id, ...data }, update: data }));
  }
  for (const { value } of rows.exerciseResults) {
    const e = value as ExerciseResult;
    const data = {
      kind: "exercise" as const,
      date: new Date(e.date),
      instrument: e.instrument,
      exerciseId: e.exerciseId,
      lessonId: e.lessonId ?? null,
      skill: e.skill ?? null,
      input: e.input,
      correct: e.correct,
      total: e.total,
      accuracy: e.accuracy,
      timingErrorMs: e.timingErrorMs ?? null,
      measured: e.measured,
      details: e.details ?? null,
      wrongQuestionIds: [],
    };
    ops.push(db.assessmentAttempt.upsert({ where: { userId_id: { userId, id: e.id } }, create: { userId, id: e.id, ...data }, update: data }));
  }
  for (const { value } of rows.practiceSessions) {
    const p = value as PracticeSession;
    const data = { instrument: p.instrument, activity: p.activity, lessonId: p.lessonId ?? null, startedAt: new Date(p.startedAt), endedAt: new Date(p.endedAt), durationSec: Math.round(p.durationSec), notes: p.notes ?? null };
    ops.push(db.practiceSession.upsert({ where: { userId_id: { userId, id: p.id } }, create: { userId, id: p.id, ...data }, update: data }));
  }
  for (const { value } of rows.chordDrills) {
    const d = value as ChordDrillResult;
    const data = {
      date: new Date(d.date),
      chordA: d.pair[0],
      chordB: d.pair[1],
      durationSec: d.durationSec,
      transitions: d.transitions,
      mode: d.mode,
      confirmedByAudio: d.confirmedByAudio ?? null,
      confirmedManually: d.confirmedManually ?? null,
      cleanRate: d.cleanRate ?? null,
      untimed: d.untimed ?? null,
    };
    ops.push(db.chordDrillResult.upsert({ where: { userId_id: { userId, id: d.id } }, create: { userId, id: d.id, ...data }, update: data }));
  }
  for (const { key, value } of rows.savedSongs) {
    ops.push(db.savedSong.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, data: json(value) }, update: { data: json(value) } }));
  }
  for (const { value } of rows.songProgress) {
    const s = value as SongProgress;
    const data = { saved: s.saved, sectionsPracticed: s.sectionsPracticed, bestTempo: s.bestTempo ?? null, minutes: s.minutes, lastPracticed: date(s.lastPracticed) };
    ops.push(
      db.songProgress.upsert({
        where: { userId_songId_instrument: { userId, songId: s.songId, instrument: s.instrument } },
        create: { userId, songId: s.songId, instrument: s.instrument, ...data },
        update: data,
      }),
    );
  }
  for (const { value } of rows.videoState) {
    const v = value as VideoState;
    const data = { favorite: v.favorite, watched: v.watched, updatedAt: new Date(v.updatedAt || Date.now()) };
    ops.push(db.savedVideo.upsert({ where: { userId_videoId: { userId, videoId: v.videoId } }, create: { userId, videoId: v.videoId, ...data }, update: data }));
  }
  for (const { value } of rows.transpositions) {
    const t = value as Transposition;
    const data = { date: new Date(t.date), progression: t.progression, originalKey: t.originalKey, capo: t.capo, shapes: t.shapes, label: t.label ?? null };
    ops.push(db.transposition.upsert({ where: { userId_id: { userId, id: t.id } }, create: { userId, id: t.id, ...data }, update: data }));
  }
  for (const { value } of rows.coachHistory) {
    const m = value as CoachMessage;
    const data = { role: m.role, content: m.content, date: new Date(m.date), source: m.source ?? null };
    ops.push(db.coachMessage.upsert({ where: { userId_id: { userId, id: m.id } }, create: { userId, id: m.id, ...data }, update: data }));
  }
  if (ops.length) await db.$transaction(ops);
  return ops.length;
}
