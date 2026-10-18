import { describe, expect, it } from "vitest";
import { isUnlocked, nextLesson, practicePlan, practiceStreak, weakSkills, weeklyMinutes } from "./engine";
import type { Lesson } from "@/content/types";
import type { LessonProgress } from "@/lib/storage/schemas";

const L = (id: string, level: 0 | 1 | 2, prereq: string[] = [], track: "theory" | "guitar" | "piano" = "theory"): Lesson => ({
  id, track, level, order: 1, title: id, summary: "", minutes: 5, skills: [], prerequisites: prereq, steps: [], quiz: [], passScore: 0.8, topics: [],
});
const done = (id: string): LessonProgress => ({ lessonId: id, track: "theory", status: "completed", stepsDone: [], quizBest: 1, quizAttempts: 1, exerciseBest: {}, startedAt: null, completedAt: "x", masteredAt: null, updatedAt: "x" });

describe("unlocking", () => {
  const a = L("a", 0);
  const b = L("b", 1, ["a"]);
  const c = L("c", 2, ["b"], "guitar");
  it("locks until prerequisites are completed (opening is not enough)", () => {
    expect(isUnlocked(b, {})).toBe(false);
    expect(isUnlocked(b, { a: { ...done("a"), status: "in-progress" } })).toBe(false);
    expect(isUnlocked(b, { a: done("a") })).toBe(true);
  });
  it("placement unlocks lower levels of that track only", () => {
    expect(isUnlocked(c, {}, { guitar: 3 })).toBe(true);
    expect(isUnlocked(c, {}, { piano: 3 })).toBe(false);
  });
  it("next lesson follows order and instrument tracks", () => {
    expect(nextLesson([a, b, c], {}, ["theory"])?.id).toBe("a");
    expect(nextLesson([a, b, c], { a: done("a") }, ["theory"])?.id).toBe("b");
    expect(nextLesson([a, b, c], { a: done("a"), b: done("b") }, ["theory"])).toBeUndefined();
    expect(nextLesson([a, b, c], { a: done("a"), b: done("b") }, ["guitar", "theory"])?.id).toBe("c");
  });
});

describe("practice stats", () => {
  const day = (d: number) => new Date(2026, 9, d, 10).toISOString();
  it("streak counts consecutive days ending today or yesterday", () => {
    const today = new Date(2026, 9, 18, 12);
    expect(practiceStreak([{ startedAt: day(18) }, { startedAt: day(17) }, { startedAt: day(16) }, { startedAt: day(14) }], today)).toBe(3);
    expect(practiceStreak([{ startedAt: day(17) }, { startedAt: day(16) }], today)).toBe(2);
    expect(practiceStreak([{ startedAt: day(15) }], today)).toBe(0);
  });
  it("weekly minutes split by instrument", () => {
    const rows = weeklyMinutes([{ id: "1", instrument: "piano", activity: "", startedAt: day(18), endedAt: day(18), durationSec: 600 }], new Date(2026, 9, 18, 12));
    expect(rows).toHaveLength(7);
    expect(rows[6].piano).toBe(10);
  });
  it("plans short sessions with breaks for long ones", () => {
    const p20 = practicePlan(20);
    expect(p20.reduce((a, b) => a + b.minutes, 0)).toBe(20);
    expect(p20.some((b) => b.kind === "break")).toBe(false);
    expect(practicePlan(60).some((b) => b.kind === "break")).toBe(true);
  });
  it("weak skills only from measured results", () => {
    const base = { id: "", date: "", instrument: "piano" as const, exerciseId: "", input: "virtual" as const, correct: 1, total: 2, accuracy: 0.5 };
    expect(weakSkills([{ ...base, skill: "x", measured: true }, { ...base, skill: "x", measured: true }]).map((w) => w.skill)).toEqual(["x"]);
    expect(weakSkills([{ ...base, skill: "y", measured: false }, { ...base, skill: "y", measured: false }])).toEqual([]);
  });
});
