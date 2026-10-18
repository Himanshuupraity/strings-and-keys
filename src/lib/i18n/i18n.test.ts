import { describe, expect, it } from "vitest";
import { EN } from "./en";
import { HI } from "./hi";
import { interpolate, lessonText, translate } from "./index";

describe("i18n dictionaries", () => {
  it("Hindi has exactly the same keys as English", () => {
    expect(Object.keys(HI).sort()).toEqual(Object.keys(EN).sort());
  });
  it("no empty translations, and placeholders match", () => {
    for (const k of Object.keys(EN) as (keyof typeof EN)[]) {
      expect(HI[k].trim().length, k).toBeGreaterThan(0);
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(HI[k]), k).toEqual(ph(EN[k]));
    }
  });
  it("Hindi strings are actually Hindi (Devanagari) where English has words", () => {
    const devanagari = /[ऀ-ॿ]/;
    const untranslated = (Object.keys(EN) as (keyof typeof EN)[]).filter((k) => /[a-z]{3}/.test(EN[k]) && !devanagari.test(HI[k]));
    expect(untranslated).toEqual([]);
  });
});

describe("interpolate / translate", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(interpolate("{a} and {b}", { a: 1 })).toBe("1 and {b}");
    expect(translate("en", "dash.lessonsCount", { done: 3, total: 10 })).toBe("3/10 lessons");
    expect(translate("hi", "dash.lessonsCount", { done: 3, total: 10 })).toBe("3/10 पाठ");
  });
});

describe("lessonText", () => {
  const lesson = { id: "zz-not-translated", title: "Title", summary: "Summary" };
  it("falls back to English when there is no Hindi", () => {
    expect(lessonText(lesson, "hi")).toEqual({ title: "Title", summary: "Summary" });
    expect(lessonText(lesson, "en")).toEqual({ title: "Title", summary: "Summary" });
  });
});
