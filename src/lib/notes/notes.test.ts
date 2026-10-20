import { beforeEach, describe, expect, it } from "vitest";
import { MemoryAdapter } from "@/lib/storage/adapter";
import { setAdapter } from "@/lib/storage/db";
import { barCol, cellFret, isBarCol, melodyMidi, tuningMidi, notesUsed, parseAsciiTab, pianoHeading, pianoTokens, tabToAscii, tuningLabels } from "./model";
import { notesRepo } from "./repo";

const INTRO = `[Intro]
e|----------------------6---|
B|-11-9-------------------6-|
G|------11-10-8---8-6-8-----|
D|--------------8-----------|
A|--------------------------|
E|--------------------------|`;

describe("parseAsciiTab", () => {
  it("reads columns, multi-digit frets and the section name", () => {
    const { sections, tuning } = parseAsciiTab(INTRO);
    expect(tuning).toBe("E A D G B E");
    expect(sections).toHaveLength(1);
    expect(sections[0].name).toBe("Intro");
    const tops = sections[0].cols.map((c) => c.find(Boolean));
    expect(tops).toEqual(["11", "9", "11", "10", "8", "8", "8", "6", "8", "6", "6"]);
    expect(sections[0].cols[0]).toEqual(["", "11", "", "", "", ""]);
  });

  it("keeps techniques and inner bar lines, drops edge bars", () => {
    const tab = ["e|-6-7-6/7h9-|-6-|", "B|-----------|---|", "G|-----------|---|", "D|-----------|---|", "A|-----------|---|", "E|-----------|---|"].join("\n");
    const cols = parseAsciiTab(tab).sections[0].cols;
    expect(cols.map((c) => (isBarCol(c) ? "|" : c[0]))).toEqual(["6", "7", "6/7h9", "|", "6"]);
  });

  it("ignores text that is not tab", () => {
    expect(parseAsciiTab("Am F C G\nhello world").sections).toEqual([]);
  });

  it("round-trips through tabToAscii", () => {
    const { sections } = parseAsciiTab(INTRO);
    const again = parseAsciiTab(tabToAscii(sections));
    expect(again.sections[0].cols).toEqual(sections[0].cols);
    expect(again.sections[0].name).toBe("Intro");
  });
});

describe("tab helpers", () => {
  it("labels lines top → bottom and reads frets", () => {
    expect(tuningLabels()).toEqual(["E", "B", "G", "D", "A", "E"]);
    expect(tuningLabels("D A D G B E")).toEqual(["E", "B", "G", "D", "A", "D"]);
    expect(cellFret("11")).toBe(11);
    expect(cellFret("7h9")).toBe(7);
    expect(cellFret("x")).toBeNull();
    expect(isBarCol(barCol())).toBe(true);
    expect(tuningMidi()).toEqual([40, 45, 50, 55, 59, 64]);
    expect(tuningMidi("D A D G B E")[0]).toBe(38);
  });
});

describe("piano notes", () => {
  it("reads note names with sharps, flats and octaves", () => {
    expect(pianoTokens("A A#  C bb4 -").map((t) => t.name)).toEqual(["A", "A#", "C", "Bb"]);
    expect(pianoTokens("C5")[0].octave).toBe(5);
  });

  it("lists the notes used from C upwards", () => {
    expect(notesUsed([{ notes: "A A# C A# A G" }, { notes: "G G F G D C#" }])).toEqual(["C", "C#", "D", "F", "G", "A", "A#"]);
  });

  it("keeps melodies close together unless an octave is written", () => {
    expect(melodyMidi(pianoTokens("A A# C A# A G"))).toEqual([69, 70, 72, 70, 69, 67]);
    expect(melodyMidi(pianoTokens("C3 C"))).toEqual([48, 48]);
  });

  it("treats a bracketed lyric with no notes as a heading", () => {
    expect(pianoHeading({ lyric: "[Chorus]", notes: "" })).toBe("Chorus");
    expect(pianoHeading({ lyric: "[Chorus]", notes: "C" })).toBeNull();
  });
});

describe("notesRepo", () => {
  beforeEach(() => setAdapter(new MemoryAdapter()));

  it("saves, lists newest first and removes", async () => {
    const a = await notesRepo.save({ kind: "chords", title: "A", artist: "", text: "[C]Hi" });
    const b = await notesRepo.save({ kind: "tab", title: "B", artist: "", tab: [{ id: "s", name: "Intro", cols: [["", "11", "", "", "", ""]] }] });
    expect((await notesRepo.list()).map((n) => n.id).sort()).toEqual([a.id, b.id].sort());
    expect((await notesRepo.get(b.id))?.tab?.[0].cols[0][1]).toBe("11");
    await notesRepo.remove(a.id);
    expect((await notesRepo.list()).map((n) => n.id)).toEqual([b.id]);
  });

  it("rejects an empty title", async () => {
    await expect(notesRepo.save({ kind: "piano", title: "", artist: "", piano: [] })).rejects.toThrow();
  });
});
