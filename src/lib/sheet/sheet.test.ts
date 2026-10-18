import { describe, expect, it } from "vitest";
import { chordLinePositions, guessKey, lyricSegments, parseSheet, sheetChords, sheetSections, transposeSheet, uniqueChords, youtubeId } from "./parse";
import { advanceOn, firstStop, nextStop, PhraseFollower } from "./follow";

// Original test text written for these tests (not from any song).
const OVER = `{title: Practice Song}
[Verse]
Am          F
Morning tea and open windows
C              G
Every day a little brighter

Chorus:
F       G        Am
Sing it slowly, sing it softly
Am | F | C | G |`;

describe("parseSheet", () => {
  it("reads chords-over-lyrics with positions, sections and chord-only lines", () => {
    const s = parseSheet(OVER);
    expect(s.title).toBe("Practice Song");
    const kinds = s.lines.map((l) => l.kind);
    expect(kinds).toEqual(["section", "lyric", "lyric", "blank", "section", "lyric", "chords"]);
    const l1 = s.lines[1] as Extract<(typeof s.lines)[number], { kind: "lyric" }>;
    expect(l1.text).toBe("Morning tea and open windows");
    expect(l1.chords).toEqual([{ chord: "Am", at: 0, col: 0 }, { chord: "F", at: 12, col: 12 }]);
    expect(lyricSegments(l1)).toEqual([{ chord: "Am", text: "Morning tea " }, { chord: "F", text: "and open windows" }]);
    expect(s.lines[6]).toMatchObject({ kind: "chords", chords: ["Am", "F", "C", "G"] });
    expect(sheetChords(s.lines)).toEqual(["Am", "F", "C", "G", "F", "G", "Am", "Am", "F", "C", "G"]);
    expect(uniqueChords(s.lines)).toEqual(["Am", "F", "C", "G"]);
  });

  it("reads ChordPro inline chords and section directives", () => {
    const s = parseSheet("{start_of_chorus}\n[G]Little [D]steps, [Em]little [C]light\n{end_of_chorus}");
    expect(s.lines[0]).toEqual({ kind: "section", name: "Chorus" });
    const l = s.lines[1] as Extract<(typeof s.lines)[number], { kind: "lyric" }>;
    expect(l.text).toBe("Little steps, little light");
    expect(l.chords.map((c) => c.chord)).toEqual(["G", "D", "Em", "C"]);
    expect(l.chords[1].at).toBe(7);
  });

  it("supports N.C. (no chord) and chords placed past the end of the words", () => {
    // Original test text (not from any song).
    const s = parseSheet("N.C.\nQuiet opening words\nF\nnext line here\n    C          G         F    C\nshort words");
    expect(s.lines[0]).toMatchObject({ kind: "lyric", text: "Quiet opening words", chords: [{ chord: "N.C.", at: 0 }] });
    expect(s.lines[1]).toMatchObject({ kind: "lyric", chords: [{ chord: "F" }] });
    const last = s.lines[2] as Extract<(typeof s.lines)[number], { kind: "lyric" }>;
    expect(last.chords.map((c) => c.col)).toEqual([4, 15, 25, 30]);
    expect(last.chords.at(-1)!.at).toBe("short words".length); // clamped for the flowing layout
    expect(sheetChords(s.lines)).toEqual(["F", "C", "G", "F", "C"]); // N.C. isn't a chord to play
    expect(uniqueChords(transposeSheet(s.lines, 2, "G"))).toEqual(["G", "D", "A"]);
  });

  it("does not mistake normal words for chords", () => {
    expect(chordLinePositions("A day to remember")).toBeNull();
    expect(chordLinePositions("Am  F  C  G")).not.toBeNull();
    expect(chordLinePositions("(Am)  F/C  x2")).toEqual([{ chord: "Am", at: 1 }, { chord: "F/C", at: 6 }]);
    expect(parseSheet("Em is my favourite chord").lines[0].kind).toBe("lyric");
  });

  it("keeps lyrics without chords and handles Hindi / Devanagari text", () => {
    const s = parseSheet("G       D\nचलो चलें हम\nplain line");
    expect(s.lines[0]).toMatchObject({ kind: "lyric", text: "चलो चलें हम" });
    expect(s.lines[1]).toMatchObject({ kind: "lyric", text: "plain line", chords: [] });
  });

  it("transposes, guesses key and builds practice sections", () => {
    const s = parseSheet(OVER);
    expect(guessKey(s.lines)).toBe("Am");
    const up = transposeSheet(s.lines, 2, "Bm");
    expect(uniqueChords(up)).toEqual(["Bm", "G", "D", "A"]);
    expect(sheetSections(s.lines).map((x) => x.name)).toEqual(["Verse", "Chorus"]);
  });

  it("extracts YouTube ids", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});

describe("follow my voice", () => {
  const frames = (follower: PhraseFollower, from: number, to: number, level: number, pitched = true) => {
    const evs: string[] = [];
    for (let t = from; t < to; t += 20) {
      const e = follower.push(level, pitched ? 0.9 : 0.1, t);
      if (e) evs.push(e);
    }
    return evs;
  };

  it("calibrates on room noise, then detects sung phrases and pauses", () => {
    const f = new PhraseFollower();
    expect(frames(f, 0, 1300, 0.004)).toEqual(["calibrated"]);
    expect(frames(f, 1300, 3300, 0.08)).toEqual(["phrase-start"]); // 2 s of singing
    expect(frames(f, 3300, 4300, 0.004)).toEqual(["phrase-end"]); // pause
  });

  it("follows normal speech/singing with short dips between syllables (the reported bug)", () => {
    const f = new PhraseFollower();
    frames(f, 0, 1100, 0.004);
    const evs: string[] = [];
    // 1.6 s of syllables: 140 ms voice, 80 ms dip — the dips must NOT break the phrase.
    for (let t = 1100; t < 2700; t += 20) {
      const inSyllable = (t - 1100) % 220 < 140;
      const e = f.push(inSyllable ? 0.05 : 0.003, inSyllable ? 0.6 : 0.1, t);
      if (e) evs.push(e);
    }
    expect(evs).toEqual(["phrase-start"]);
    expect(frames(f, 2700, 3600, 0.003, false)).toEqual(["phrase-end"]);
  });

  it("tracks the room level even if you start singing straight away", () => {
    const f = new PhraseFollower();
    for (let t = 0; t < 1000; t += 20) f.push(t < 400 ? 0.004 : 0.08, 0.9, t);
    expect(f.threshold).toBeLessThan(0.02);
  });

  it("works with a noisy room / small voice-to-pause difference (+8 dB), as on many laptop mics", () => {
    const f = new PhraseFollower();
    frames(f, 0, 700, 0.03);
    const evs: string[] = [];
    for (let t = 700; t < 2700; t += 20) {
      const on = (t - 700) % 220 < 150;
      const e = f.push(on ? 0.075 : 0.035, on ? 0.7 : 0.2, t);
      if (e) evs.push(e);
    }
    expect(evs).toEqual(["phrase-start"]);
    expect(frames(f, 2700, 3500, 0.03, false)).toEqual(["phrase-end"]);
    expect(f.aboveFloorDb).toBeLessThan(3);
  });

  it("a long sung line with no pause still ends when you breathe, and the next line follows", () => {
    const f = new PhraseFollower();
    frames(f, 0, 700, 0.005);
    expect(frames(f, 700, 6700, 0.06)).toEqual(["phrase-start"]); // 6 s held phrase
    expect(frames(f, 6700, 7500, 0.005, false)).toEqual(["phrase-end"]);
    expect(frames(f, 7500, 9000, 0.06)).toEqual(["phrase-start"]);
  });

  it("accepts spoken (less pitched) words when loud enough", () => {
    const f = new PhraseFollower();
    frames(f, 0, 1100, 0.004);
    expect(frames(f, 1100, 2400, 0.05, false)).toEqual(["phrase-start"]);
  });

  it("ignores short noises and unpitched quiet sounds", () => {
    const f = new PhraseFollower();
    frames(f, 0, 1300, 0.004);
    expect(frames(f, 1300, 1500, 0.08)).toEqual(["phrase-start"]);
    expect(frames(f, 1500, 2600, 0.004)).toEqual([]); // 200 ms phrase is too short to count
    expect(frames(f, 2600, 4000, 0.006, false)).toEqual([]); // unpitched and only just above the room (+3.5 dB)
  });

  it("moves line by line, skipping blanks and sections; instrumental lines wait for the voice", () => {
    const s = parseSheet(OVER).lines;
    let cur = firstStop(s);
    expect(cur).toBe(1);
    cur = advanceOn(s, cur, "phrase-end");
    expect(cur).toBe(2);
    cur = advanceOn(s, cur, "phrase-end");
    expect(cur).toBe(5); // skipped blank + "Chorus:"
    cur = advanceOn(s, cur, "phrase-end");
    expect(cur).toBe(6); // instrumental chord line
    expect(advanceOn(s, cur, "phrase-end")).toBe(6); // humming over chords doesn't skip it
    expect(nextStop(s, 6)).toBe(6); // end of song
  });
});
