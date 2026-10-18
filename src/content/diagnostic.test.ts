import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_QUESTIONS, NOT_SURE, TIERS, scorePlacement, scoreTrack, type Answers } from "./diagnostic";
import { isUnlocked } from "@/lib/progress/engine";
import type { Lesson } from "./types";

const allCorrect = (filter: (id: string) => boolean = () => true): Answers =>
  Object.fromEntries(DIAGNOSTIC_QUESTIONS.filter((q) => filter(q.id)).map((q) => [q.id, q.answer]));

describe("diagnostic placement", () => {
  it("every tier has at least 3 questions and answers are valid, never 'not sure'", () => {
    for (const [track, tiers] of Object.entries(TIERS)) {
      for (const tier of tiers) expect(DIAGNOSTIC_QUESTIONS.filter((q) => q.track === track && q.tier === tier).length).toBeGreaterThanOrEqual(3);
    }
    for (const q of DIAGNOSTIC_QUESTIONS) {
      expect(q.options.at(-1)).toBe(NOT_SURE);
      expect(q.options[q.answer]).not.toBe(NOT_SURE);
    }
  });
  it("no answers → level 0 everywhere", () => {
    const r = scorePlacement(["theory", "guitar", "piano"], {});
    expect(r.theory!.placement).toBe(0);
    expect(r.guitar!.placement).toBe(0);
    expect(r.piano!.placement).toBe(0);
  });
  it("all correct → placed above every tier", () => {
    const a = allCorrect();
    expect(scoreTrack("theory", a).placement).toBe(6);
    expect(scoreTrack("guitar", a).placement).toBe(4);
    expect(scoreTrack("piano", a).placement).toBe(5);
  });
  it("stops at the first failed tier even if later tiers are answered correctly", () => {
    const a = allCorrect((id) => !id.startsWith("t1-"));
    const r = scoreTrack("theory", a);
    expect(r.placement).toBe(1);
    expect(r.tiers.find((t) => t.tier === 5)!.passed).toBe(false);
  });
  it("2 of 3 correct passes a tier; 'not sure' counts as wrong", () => {
    const notSureIdx = DIAGNOSTIC_QUESTIONS.find((q) => q.id === "t0-tempo")!.options.length - 1;
    const a: Answers = { "t0-higher": 1, "t0-tempo": notSureIdx, "t0-beat": 0 };
    expect(scoreTrack("theory", a).placement).toBe(1);
    expect(scoreTrack("theory", { "t0-higher": 1, "t0-tempo": notSureIdx }).placement).toBe(0);
  });
  it("placement unlocks lessons below it via isUnlocked", () => {
    const lesson = { id: "x", track: "guitar", level: 3, prerequisites: ["y"] } as unknown as Lesson;
    expect(isUnlocked(lesson, {}, { guitar: scoreTrack("guitar", allCorrect()).placement })).toBe(true);
    expect(isUnlocked(lesson, {}, { guitar: scoreTrack("guitar", allCorrect((id) => id.startsWith("g2"))).placement })).toBe(false);
  });
});
