import { describe, expect, it } from "vitest";
import { BUILT_IN_SONGS, CATALOGUE_SONGS } from "./index";
import { barSpans, parseChordChart, parseMelody, sectionChords, sectionLength } from "./parse";
import { chordPitchClasses, parseChord } from "@/lib/music/chords";
import { mod12, pitchClassOf } from "@/lib/music/notes";
import { scalePitchClasses } from "@/lib/music/scales";
import { VIDEOS, VIDEO_CATEGORIES, VIDEO_SEARCHES } from "../videos";

describe("built-in songs", () => {
  it("have unique ids", () => {
    const ids = [...BUILT_IN_SONGS.map((s) => s.id), ...CATALOGUE_SONGS.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const song of BUILT_IN_SONGS) {
    describe(song.title, () => {
      it("uses only known chord symbols and full bars", () => {
        for (const sec of song.sections)
          for (const bar of sec.bars) {
            const spans = barSpans(bar, song.beatsPerBar);
            expect(spans.reduce((a, s) => a + s.beats, 0)).toBe(song.beatsPerBar);
            for (const s of spans) expect(parseChord(s.chord), s.chord).not.toBeNull();
          }
      });

      it("melody fills exactly the section length", () => {
        for (const sec of song.sections) {
          if (!sec.melody) continue;
          const notes = parseMelody(sec.melody);
          const total = notes.reduce((a, n) => a + n.beats, 0);
          expect(total, sec.id).toBe(sectionLength(sec, song.beatsPerBar));
        }
      });

      it("melody notes belong to the song's scale", () => {
        const tonic = song.key.replace(/m$/, "");
        const allowed = new Set([...scalePitchClasses(tonic, song.scale), ...(song.extraNotes ?? []).map(pitchClassOf)]);
        const melodies = [song.pickup, ...song.sections.map((s) => s.melody)];
        for (const m of melodies)
          for (const n of parseMelody(m)) if (n.midi !== null) expect(allowed.has(mod12(n.midi)), `${song.id} note ${n.midi}`).toBe(true);
      });

      it("most notes starting with each chord are chord tones", () => {
        let checked = 0;
        let ok = 0;
        for (const sec of song.sections) {
          if (!sec.melody) continue;
          const notes = parseMelody(sec.melody);
          for (const span of sectionChords(sec, song.beatsPerBar)) {
            const n = notes.find((x) => x.start === span.start);
            if (!n || n.midi === null) continue;
            checked++;
            if (chordPitchClasses(span.chord).includes(mod12(n.midi))) ok++;
          }
        }
        if (checked) expect(ok / checked, song.id).toBeGreaterThanOrEqual(0.6);
      });
    });
  }

  it("parses user chord charts", () => {
    expect(parseChordChart("G D | Em | C", 4)).toEqual([[["G", 2], ["D", 2]], "Em", "C"]);
  });
});

describe("video library", () => {
  it("has valid, unique, verified entries", () => {
    expect(VIDEOS.length).toBeGreaterThanOrEqual(25);
    const ids = VIDEOS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    const cats = new Set(VIDEO_CATEGORIES.map((c) => c.id));
    for (const v of VIDEOS) {
      expect(v.id).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(v.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(v.title.length).toBeGreaterThan(3);
      expect(v.creator.length).toBeGreaterThan(1);
      expect(cats.has(v.category)).toBe(true);
    }
  });
  it("every category has a verified video or a search fallback", () => {
    for (const c of VIDEO_CATEGORIES) {
      const n = VIDEOS.filter((v) => v.category === c.id).length + VIDEO_SEARCHES.filter((s) => s.category === c.id).length;
      expect(n, c.id).toBeGreaterThan(0);
    }
  });
});
