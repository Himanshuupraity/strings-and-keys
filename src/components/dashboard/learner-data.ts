"use client";

import { useData } from "@/hooks/use-data";
import { drillRepo, exerciseRepo, goalsRepo, practiceRepo, profileRepo, progressRepo, songRepo } from "@/lib/storage/repositories";
import { DEFAULT_GOALS, type ChordDrillResult, type ExerciseResult, type Goals, type LessonProgress, type PracticeSession, type Profile, type SongProgress } from "@/lib/storage/schemas";
import { LESSONS } from "@/content/curriculum";
import { isDone, practiceStreak } from "@/lib/progress/engine";
import type { Lesson } from "@/content/types";

export interface LearnerData {
  profile?: Profile;
  goals: Goals;
  progress: Record<string, LessonProgress>;
  sessions: PracticeSession[];
  exercises: ExerciseResult[];
  drills: ChordDrillResult[];
  songs: SongProgress[];
}

const EMPTY: LearnerData = { goals: DEFAULT_GOALS, progress: {}, sessions: [], exercises: [], drills: [], songs: [] };

/** Everything the dashboard and progress pages need, reloaded when any collection changes. */
export function useLearnerData() {
  return useData<LearnerData>(
    async () => {
      const [profile, goals, progress, sessions, exercises, drills, songs] = await Promise.all([
        profileRepo.get(), goalsRepo.get(), progressRepo.all(), practiceRepo.list(), exerciseRepo.list(), drillRepo.list(), songRepo.list(),
      ]);
      return { profile, goals, progress, sessions, exercises, drills, songs };
    },
    ["profile", "goals", "lessonProgress", "practiceSessions", "exerciseResults", "chordDrills", "songProgress"],
    EMPTY,
  );
}

export function isEmptyLearner(d: LearnerData) {
  return Object.keys(d.progress).length === 0 && d.sessions.length === 0 && d.exercises.length === 0 && d.drills.length === 0;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
}

export function achievements(d: LearnerData): Achievement[] {
  const done = Object.values(d.progress).filter(isDone);
  const mastered = Object.values(d.progress).filter((p) => p.status === "mastered");
  const minutes = d.sessions.reduce((a, s) => a + s.durationSec, 0) / 60;
  const streak = practiceStreak(d.sessions);
  const level0 = LESSONS.filter((l) => l.level === 0);
  const instruments = new Set(d.sessions.map((s) => s.instrument));
  const bestDrill = Math.max(0, ...d.drills.filter((x) => !x.untimed).map((x) => x.transitions));
  return [
    { id: "first-note", title: "First notes", description: "Complete any measured exercise.", earned: d.exercises.some((e) => e.measured) },
    { id: "first-lesson", title: "First lesson", description: "Complete your first lesson (all steps + quiz).", earned: done.length >= 1 },
    { id: "five-lessons", title: "Building blocks", description: "Complete 5 lessons.", earned: done.length >= 5 },
    { id: "level-0", title: "Zero to one", description: "Complete every Level 0 lesson.", earned: level0.length > 0 && level0.every((l) => isDone(d.progress[l.id])) },
    { id: "mastered", title: "Proven skill", description: "Master a lesson with measured exercises.", earned: mastered.length >= 1 },
    { id: "streak-3", title: "Three-day habit", description: "Practise 3 days in a row.", earned: streak >= 3 },
    { id: "streak-7", title: "Week-long streak", description: "Practise 7 days in a row.", earned: streak >= 7 },
    { id: "hour", title: "First hour", description: "Log 60 minutes of practice.", earned: minutes >= 60 },
    { id: "drill", title: "Quick changes", description: "Finish a 1-minute chord change drill.", earned: d.drills.some((x) => !x.untimed) },
    { id: "drill-30", title: "Smooth switcher", description: "Reach 30 changes in one minute.", earned: bestDrill >= 30 },
    { id: "both", title: "Two instruments", description: "Practise both guitar and piano.", earned: instruments.size === 2 },
  ];
}

/** Current level for an instrument: lowest level that still has unfinished lessons on that path. */
export function currentLevel(lessons: Lesson[], progress: Record<string, LessonProgress>, placement = 0): number {
  const open = lessons.filter((l) => !isDone(progress[l.id]) && l.level >= placement);
  return open.length ? Math.min(...open.map((l) => l.level)) : Math.max(0, ...lessons.map((l) => l.level));
}
