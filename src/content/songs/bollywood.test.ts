import { describe, expect, it } from "vitest";
import { BOLLYWOOD_CHARTS } from "./bollywood";
import { BUILT_IN_SONGS, CATALOGUE_SONGS } from "./index";
import { chordPitchClasses, easiestShape, parseChord } from "@/lib/music/chords";
import { shapeForSoundingChord, transposeChord } from "@/lib/music/transpose";
import { songChords } from "./parse";

describe("Bollywood chord charts", () => {
  it("are present and listed first", () => {
    expect(BOLLYWOOD_CHARTS.length).toBeGreaterThanOrEqual(10);
    expect(BUILT_IN_SONGS[0].source).toBe("chord-chart");
  });
  it.each(BOLLYWOOD_CHARTS.map((s) => [s.title, s] as const))("%s: valid, sourced, chords only", (_t, s) => {
    expect(s.source).toBe("chord-chart");
    expect(s.genre).toBe("bollywood");
    expect(s.sources!.length).toBeGreaterThanOrEqual(2);
    for (const src of s.sources!) expect(src.url).toMatch(/^https?:\/\//);
    // No melody (copyrighted) and no lyric-like text fields.
    expect(s.sections.every((sec) => !sec.melody)).toBe(true);
    expect(s.film && s.composer && s.year).toBeTruthy();
    for (const c of songChords(s)) expect(parseChord(c), c).not.toBeNull();
  });
  it("sounding chords = shapes moved up by the capo, and every shape is playable", () => {
    for (const s of BOLLYWOOD_CHARTS) {
      const capo = s.sourceCapo ?? 0;
      for (const sounding of songChords(s)) {
        const shape = shapeForSoundingChord(sounding, capo);
        expect(easiestShape(shape), `${s.title}: ${shape}`).toBeDefined();
        const back = transposeChord(shape, capo, s.key);
        expect(chordPitchClasses(back).sort()).toEqual(chordPitchClasses(sounding).sort());
      }
    }
  });
  it("chart ids are unique and don't collide with catalogue ids", () => {
    const ids = [...BUILT_IN_SONGS.map((s) => s.id), ...CATALOGUE_SONGS.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("Tum Hi Ho: capo 1 Em shapes sound in F minor", () => {
    const s = BOLLYWOOD_CHARTS.find((x) => x.title === "Tum Hi Ho")!;
    expect(s.sourceCapo).toBe(1);
    expect(s.key).toBe("Fm");
    expect(songChords(s)).toContain("Fm");
  });
});
