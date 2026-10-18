import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/curriculum";
import { LESSON_HI } from "./lessons-hi";

const DEVANAGARI = /[ऀ-ॿ]/;

describe("Hindi lesson titles and summaries", () => {
  it("cover every lesson, with Hindi text", () => {
    for (const l of LESSONS) {
      const hi = LESSON_HI[l.id];
      expect(hi, l.id).toBeDefined();
      expect(hi.title.trim().length, l.id).toBeGreaterThan(0);
      expect(hi.summary.trim().length, l.id).toBeGreaterThan(0);
      expect(DEVANAGARI.test(hi.title) || DEVANAGARI.test(hi.summary), l.id).toBe(true);
      expect(DEVANAGARI.test(hi.summary), `${l.id} summary`).toBe(true);
    }
  });

  it("has no ids that aren't real lessons", () => {
    const ids = new Set(LESSONS.map((l) => l.id));
    expect(Object.keys(LESSON_HI).filter((id) => !ids.has(id))).toEqual([]);
  });
});
