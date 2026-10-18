import { describe, expect, it } from "vitest";
import type { Song } from "@/content/songs/types";
import type { ChordDrillResult, SongProgress } from "@/lib/storage/schemas";
import type { Lesson } from "@/content/types";
import { BUILT_IN_SONGS } from "@/content/songs";
import { canonChord, knownChords, songShapes } from "./known-chords";
import { recommendSongs } from "./recommend";
import { songStatus } from "./status";

const song = (id: string, sections: { id: string; bars: string[] }[], extra: Partial<Song> = {}): Song =>
  ({ id, title: id, artist: "", source: "chord-chart", licence: "", genre: "bollywood", difficulty: 2, key: "C", scale: "major", tempo: 80, beatsPerBar: 4, intro: "", sections: sections.map((s) => ({ ...s, name: s.id })), strum: { pattern: "", description: "" }, pianoTip: "", prerequisites: [], tags: [], ...extra }) as Song;

const prog = (songId: string, mastered: string[], instrument: "guitar" | "piano" = "guitar"): SongProgress => ({ songId, instrument, saved: false, sectionsPracticed: [], sectionsMastered: mastered, minutes: 0 });

describe("song status", () => {
  const s = song("a", [{ id: "v", bars: ["C"] }, { id: "c", bars: ["G"] }]);
  it("is driven by the student's 'I can play this' marks", () => {
    expect(songStatus(s).state).toBe("new");
    expect(songStatus(s, { sectionsMastered: [], sectionsPracticed: ["v"], minutes: 0 }).state).toBe("learning");
    expect(songStatus(s, { sectionsMastered: ["v"], sectionsPracticed: [], minutes: 0 })).toMatchObject({ state: "can-play", pct: 0.5 });
    expect(songStatus(s, { sectionsMastered: ["v", "c", "gone"], sectionsPracticed: [], minutes: 0 })).toMatchObject({ state: "mastered", pct: 1 });
  });
});

describe("known chords", () => {
  it("canonicalises spellings and slash chords", () => {
    expect(canonChord("A#m")).toBe("Bbm");
    expect(canonChord("C/G")).toBe("C");
    expect(canonChord("nope")).toBeNull();
  });
  it("uses guitar SHAPES for capo songs, sounding chords for piano", () => {
    const capo = song("cap", [{ id: "v", bars: ["Bb", "F", "Gm", "Eb"] }], { sourceCapo: 3 });
    expect(songShapes(capo, "guitar")).toEqual(["G", "D", "Em", "C"]);
    expect(songShapes(capo, "piano")).toEqual(["Bb", "F", "Gm", "Eb"]);
  });
  it("collects evidence from mastered sections, fast drills and completed lessons — per instrument", () => {
    const s = song("s", [{ id: "v", bars: ["Am", "F"] }, { id: "c", bars: ["C", "G"] }]);
    const drill = (pair: [string, string], transitions: number): ChordDrillResult => ({ id: "d", date: "", pair, durationSec: 60, transitions, mode: "self" });
    const lesson = { id: "l", track: "guitar", title: "E and A", steps: [{ id: "x", kind: "visual", title: "", body: "", visual: { type: "chord-diagram", chords: ["E", "A"] } }] } as unknown as Lesson;
    const k = knownChords({
      instrument: "guitar",
      songs: [s],
      songProgress: [prog("s", ["v"]), prog("s", ["c"], "piano")],
      drills: [drill(["Em", "D"], 22), drill(["Bm", "G"], 9)],
      lessons: [lesson],
      lessonProgress: { l: { lessonId: "l", track: "guitar", status: "completed", stepsDone: [], quizBest: 1, quizAttempts: 1, exerciseBest: {}, startedAt: null, completedAt: "x", masteredAt: null, updatedAt: "x" } },
    });
    expect([...k.keys()].sort()).toEqual(["A", "Am", "D", "E", "Em", "F"]);
    expect(k.get("Am")).toMatch(/can play it in s/);
    expect(k.has("Bm")).toBe(false); // drill too slow to count
    expect(k.has("C")).toBe(false); // mastered on piano, not guitar
  });
});

describe("recommendations", () => {
  const easy = song("easy", [{ id: "v", bars: ["G", "D", "Em", "C"] }]);
  const oneNew = song("one-new", [{ id: "v", bars: ["G", "D", "Bm"] }], { difficulty: 3 });
  const hard = song("hard", [{ id: "v", bars: ["F#m", "Bm", "C#m", "Ab"] }], { difficulty: 4 });
  const english = song("eng", [{ id: "v", bars: ["G", "D"] }], { source: "public-domain", genre: "children" });

  it("prefers songs whose chords you know, explains why, skips mastered songs", () => {
    const r = recommendSongs({ songs: [hard, oneNew, easy, english], known: new Set(["G", "D", "Em", "C"]), songProgress: [], instrument: "guitar" });
    expect(r[0].song.id).toBe("easy");
    expect(r[0].reason).toMatch(/already know all its chords/);
    const one = r.find((x) => x.song.id === "one-new")!;
    expect(one.newChords).toEqual(["Bm"]);
    expect(one.reason).toBe("You know G and D — only Bm is new");
    expect(r.findIndex((x) => x.song.id === "eng")).toBeGreaterThan(r.findIndex((x) => x.song.id === "one-new")); // Hindi first
    const withMastered = recommendSongs({ songs: [easy, oneNew], known: new Set(["G"]), songProgress: [prog("easy", ["v"])], instrument: "guitar" });
    expect(withMastered.map((x) => x.song.id)).toEqual(["one-new"]);
  });

  it("gives a beginner easy Bollywood songs from the real catalogue", () => {
    const r = recommendSongs({ songs: BUILT_IN_SONGS, known: new Set(), songProgress: [], instrument: "guitar" });
    expect(r).toHaveLength(3);
    for (const x of r) {
      expect(x.song.source).toBe("chord-chart");
      expect(x.song.difficulty).toBeLessThanOrEqual(3);
      expect(x.reason).toMatch(/first song/);
    }
  });
});
