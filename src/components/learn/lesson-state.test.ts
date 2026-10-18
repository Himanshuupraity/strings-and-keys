import { describe, expect, it } from "vitest";
import type { Lesson } from "@/content/types";
import { lessonView, summarizeLevels, currentLevel } from "./lesson-state";
import { emptyProgress } from "@/lib/progress/engine";

const L = (id: string, level: Lesson["level"], prerequisites: string[] = [], track: Lesson["track"] = "theory"): Lesson => ({
  id, track, level, order: 1, title: id, summary: "", minutes: 5, skills: [], prerequisites, steps: [], quiz: [], passScore: 0.8, topics: [],
});

describe("lesson view state", () => {
  const a = L("a", 0);
  const b = L("b", 1, ["a"]);
  it("locks lessons with unmet prerequisites and lists them", () => {
    const v = lessonView(b, {});
    expect(v.unlocked).toBe(false);
    expect(v.missing).toEqual(["a"]);
  });
  it("unlocks after the prerequisite is completed", () => {
    const v = lessonView(b, { a: { ...emptyProgress(a), status: "completed" } });
    expect(v.unlocked).toBe(true);
  });
  it("placement unlocks lower levels", () => {
    expect(lessonView(b, {}, { theory: 2 }).unlocked).toBe(true);
  });
  it("summarises levels and finds the current level", () => {
    const levels = summarizeLevels([a, b], { a: { ...emptyProgress(a), status: "mastered" } });
    expect(levels[0]).toMatchObject({ level: 0, done: 1, complete: true, allMastered: true });
    expect(levels[1].complete).toBe(false);
    expect(currentLevel(levels)).toBe(1);
  });
});
