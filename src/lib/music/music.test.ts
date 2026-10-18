import { describe, expect, it } from "vitest";
import { centsBetween, frequencyToNote, midiToFrequency, midiToName, nameToMidi, parseNote, pcDualName } from "./notes";
import { KEYBOARD_PRESETS, SELECTABLE_SIZES, keysForPreset, notesOfPitchClass, fitToRange, whiteKeyCount } from "./keyboard";
import { fretMidi, fretNoteName, openStringsWithCapo, positionsOfPitchClass, soundingMidi, STANDARD_TUNING } from "./guitar";
import { chordMidi, chordNoteNames, chordPitchClasses, identifyChord, OPEN_SHAPES, parseChord, shapePitchClasses, shapesForChord, compareChordTones } from "./chords";
import { scaleMidi, scaleNoteNames, scalePitchClasses, circleOfFifths, relativeMinor, diatonicChords } from "./scales";
import { bestCapoArrangement, capoArrangements, keyChangeOptions, shapeForSoundingChord, soundingChordForShape, transposeChord, transposeKey, transposeProgression } from "./transpose";
import { labelNote, swaraFor, SWARAS, saptakFor, referenceSaMidi, alankarMidi, ALANKARS } from "./sargam";

describe("notes", () => {
  it("maps MIDI to scientific pitch names (middle C = C4 = 60)", () => {
    expect(midiToName(60)).toBe("C4");
    expect(midiToName(69)).toBe("A4");
    expect(midiToName(21)).toBe("A0");
    expect(midiToName(108)).toBe("C8");
    expect(midiToName(61, "flat")).toBe("Db4");
  });
  it("parses names to MIDI including enharmonics", () => {
    expect(nameToMidi("C4")).toBe(60);
    expect(nameToMidi("A#3")).toBe(nameToMidi("Bb3"));
    expect(nameToMidi("B#3")).toBe(60);
    expect(nameToMidi("Cb4")).toBe(59);
    expect(parseNote("F♯2")?.pc).toBe(6);
  });
  it("converts frequency to notes", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440);
    expect(midiToFrequency(60)).toBeCloseTo(261.626, 2);
    const e2 = frequencyToNote(82.41)!;
    expect(e2.name).toBe("E2");
    expect(Math.abs(e2.cents)).toBeLessThan(1);
    const sharpA = frequencyToNote(445)!;
    expect(sharpA.name).toBe("A4");
    expect(sharpA.cents).toBeCloseTo(19.56, 1);
    expect(frequencyToNote(432, 432)!.name).toBe("A4");
    expect(frequencyToNote(-1)).toBeNull();
    expect(centsBetween(880, 440)).toBeCloseTo(1200);
  });
  it("dual names", () => {
    expect(pcDualName(1)).toBe("C#/Db");
    expect(pcDualName(4)).toBe("E");
  });
});

describe("keyboard presets", () => {
  it.each(SELECTABLE_SIZES)("%i-key preset has exactly that many keys", (size) => {
    const keys = keysForPreset(size);
    expect(keys).toHaveLength(size);
    expect(keys[0].midi).toBe(KEYBOARD_PRESETS[size].low);
    expect(keys.at(-1)!.midi).toBe(KEYBOARD_PRESETS[size].high);
    expect(keys.filter((k) => k.isMiddleC)).toHaveLength(1);
  });
  it("88 keys: A0..C8, 52 white and 36 black, names consistent with MIDI", () => {
    const keys = keysForPreset(88);
    expect(whiteKeyCount(keys)).toBe(52);
    expect(keys.filter((k) => k.black)).toHaveLength(36);
    for (const k of keys) expect(nameToMidi(k.name)).toBe(k.midi);
    expect(keys[0].name).toBe("A0");
    expect(keys[87].name).toBe("C8");
  });
  it("finds every C", () => {
    expect(notesOfPitchClass(0, 21, 108)).toEqual([24, 36, 48, 60, 72, 84, 96, 108]);
  });
  it("fits targets into a range by octaves", () => {
    expect(fitToRange([60, 64, 67], 72, 96)).toEqual([72, 76, 79]);
    expect(fitToRange([100, 103], 36, 84)).toEqual([76, 79]);
  });
});

describe("guitar fretboard", () => {
  it("standard tuning is E2 A2 D3 G3 B3 E4", () => {
    expect(STANDARD_TUNING.map((m) => midiToName(m))).toEqual(["E2", "A2", "D3", "G3", "B3", "E4"]);
  });
  it("calculates fret notes", () => {
    expect(fretNoteName(0, 5)).toBe("A");
    expect(fretNoteName(1, 3)).toBe("C");
    expect(fretNoteName(3, 4)).toBe("B");
    expect(fretNoteName(4, 1)).toBe("C");
    expect(fretNoteName(5, 12)).toBe("E");
    expect(fretMidi(0, 12)).toBe(52);
    // 5th fret of each string = next open string, except G->B (4th fret)
    for (const s of [0, 1, 2, 4]) expect(fretMidi(s, 5)).toBe(STANDARD_TUNING[s + 1]);
    expect(fretMidi(3, 4)).toBe(STANDARD_TUNING[4]);
  });
  it("capo shifts open strings and blocks frets behind it", () => {
    expect(openStringsWithCapo(2).map((m) => midiToName(m))).toEqual(["F#2", "B2", "E3", "A3", "C#4", "F#4"]);
    expect(soundingMidi(0, 0, 3)).toBe(43);
    expect(soundingMidi(0, 2, 3)).toBeNull();
    expect(soundingMidi(0, 5, 3)).toBe(45);
  });
  it("finds positions of a pitch class", () => {
    const es = positionsOfPitchClass(4, 12);
    expect(es.filter((p) => p.string === 0).map((p) => p.fret)).toEqual([0, 12]);
  });
});

describe("chords", () => {
  it("parses symbols", () => {
    expect(parseChord("F#m7")?.suffix).toBe("m7");
    expect(parseChord("Bb")?.rootPc).toBe(10);
    expect(parseChord("C/G")?.bassPc).toBe(7);
    expect(parseChord("Hm")).toBeNull();
  });
  it("constructs triads and sevenths with correct spelling", () => {
    expect(chordNoteNames("C")).toEqual(["C", "E", "G"]);
    expect(chordNoteNames("Bb")).toEqual(["Bb", "D", "F"]);
    expect(chordNoteNames("F#m")).toEqual(["F#", "A", "C#"]);
    expect(chordNoteNames("Bdim")).toEqual(["B", "D", "F"]);
    expect(chordNoteNames("Caug")).toEqual(["C", "E", "G#"]);
    expect(chordNoteNames("G7")).toEqual(["G", "B", "D", "F"]);
    expect(chordNoteNames("Ebmaj7")).toEqual(["Eb", "G", "Bb", "D"]);
  });
  it("builds inversions", () => {
    expect(chordMidi("C", 4)).toEqual([60, 64, 67]);
    expect(chordMidi("C", 4, 1)).toEqual([64, 67, 72]);
    expect(chordMidi("C", 4, 2)).toEqual([67, 72, 76]);
  });
  it("every built-in open shape sounds only its chord tones, including the root", () => {
    for (const s of OPEN_SHAPES) {
      const tones = chordPitchClasses(s.chord);
      const sounding = shapePitchClasses(s);
      expect(sounding.every((pc) => tones.includes(pc)), s.chord).toBe(true);
      expect(sounding).toContain(parseChord(s.chord)!.rootPc);
      expect(s.frets).toHaveLength(6);
    }
  });
  it("movable barre shapes are correct", () => {
    const f = shapesForChord("F");
    const barreF = f.find((s) => s.kind === "barre" && s.frets[0] === 1)!;
    expect(barreF.frets).toEqual([1, 3, 3, 2, 1, 1]);
    const bm = shapesForChord("Bm").find((s) => s.frets[1] === 2)!;
    expect(bm.frets).toEqual([-1, 2, 4, 4, 3, 2]);
    expect(shapesForChord("Bb")[0].frets).toEqual([-1, 1, 3, 3, 3, 1]);
  });
  it("identifies chords from pitch classes", () => {
    expect(identifyChord([2, 6, 9])[0].symbol).toBe("D");
    expect(identifyChord([9, 0, 4])[0].symbol).toBe("Am");
    expect(identifyChord([7, 11, 2, 5])[0].symbol).toBe("G7");
  });
  it("compares chord tones", () => {
    const r = compareChordTones("C", [0, 4, 6]);
    expect(r.missing).toEqual([7]);
    expect(r.unwanted).toEqual([6]);
  });
});

describe("scales", () => {
  it("generates spelled scales", () => {
    expect(scaleNoteNames("C", "major")).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
    expect(scaleNoteNames("F", "major")).toEqual(["F", "G", "A", "Bb", "C", "D", "E"]);
    expect(scaleNoteNames("A", "naturalMinor")).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    expect(scaleNoteNames("A", "harmonicMinor")).toEqual(["A", "B", "C", "D", "E", "F", "G#"]);
    expect(scalePitchClasses("E", "minorPentatonic")).toEqual([4, 7, 9, 11, 2]);
    expect(scaleMidi("C", "major")).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });
  it("circle of fifths and relatives", () => {
    const c = circleOfFifths();
    expect(c[0]).toMatchObject({ major: "C", minor: "Am" });
    expect(c[1].major).toBe("G");
    expect(c[11].major).toBe("F");
    expect(relativeMinor("G")).toBe("E");
    expect(diatonicChords("C")).toEqual(["C", "Dm", "Em", "F", "G", "Am", "Bdim"]);
  });
});

describe("transposition & capo", () => {
  it("transposes chords with key-aware spelling", () => {
    expect(transposeChord("C", 5, "F")).toBe("F");
    expect(transposeChord("G", 3, "Bb")).toBe("Bb");
    expect(transposeChord("G", 3)).toBe("A#");
    expect(transposeChord("Am7", 2, "D")).toBe("Bm7");
    expect(transposeChord("C/G", 2, "D")).toBe("D/A");
    expect(transposeProgression(["G", "D", "Em", "C"], -2, "F")).toEqual(["F", "C", "Dm", "Bb"]);
    expect(transposeKey("C", 7)).toBe("G");
    expect(transposeKey("Am", 3)).toBe("Cm");
  });
  it("capo maps shapes to sounding chords and back", () => {
    expect(soundingChordForShape("G", 2, "A")).toBe("A");
    expect(soundingChordForShape("C", 3, "Eb")).toBe("Eb");
    expect(shapeForSoundingChord("Bb", 3)).toBe("G");
    expect(shapeForSoundingChord("F", 5)).toBe("C");
    expect(shapeForSoundingChord("F#m", 2)).toBe("Em");
  });
  it("F–Bb–C gets an all-open capo arrangement that preserves the sounding key", () => {
    const prog = ["F", "Bb", "C"];
    const best = bestCapoArrangement(prog, "F");
    expect(best.verified).toBe(true);
    expect(best.allOpen).toBe(true);
    expect(best.sounding).toEqual(prog);
    // Re-derive sounding chords from shapes + capo and compare pitch classes
    best.shapes.forEach((shape, i) => {
      const back = soundingChordForShape(shape, best.capo, "F");
      expect(chordPitchClasses(back).sort()).toEqual(chordPitchClasses(prog[i]).sort());
    });
    expect([3, 5]).toContain(best.capo);
  });
  it("every verified arrangement reproduces the original chord tones from actual shape frets", () => {
    const prog = ["Eb", "Cm", "Ab", "Bb"];
    for (const a of capoArrangements(prog, "Eb")) {
      if (!a.verified) continue;
      a.shapeDetails.forEach((d, i) => {
        const pcs = shapePitchClasses(d!, a.capo);
        const target = chordPitchClasses(prog[i]);
        expect(pcs.every((p) => target.includes(p))).toBe(true);
        expect(pcs).toContain(parseChord(prog[i])!.rootPc);
      });
    }
  });
  it("key change options actually change key and are labelled with semitones", () => {
    const opts = keyChangeOptions(["F", "Bb", "C"], "F");
    expect(opts.every((o) => o.targetKey !== "F")).toBe(true);
    const g = opts.find((o) => o.targetKey === "G")!;
    expect(g.chords).toEqual(["G", "C", "D"]);
    expect(g.semitones).toBe(2);
  });
});

describe("sargam", () => {
  it("maps with C as Sa", () => {
    const names = Array.from({ length: 12 }, (_, i) => swaraFor(60 + i, 0).full);
    expect(names).toEqual(["Sa", "komal Re", "Re", "komal Ga", "Ga", "Ma", "tivra Ma", "Pa", "komal Dha", "Dha", "komal Ni", "Ni"]);
  });
  it("Sa is movable: with D as tonic, D is Sa and C is komal Ni", () => {
    expect(swaraFor(62, 2).full).toBe("Sa");
    expect(swaraFor(60, 2).full).toBe("komal Ni");
    expect(swaraFor(66, 2).full).toBe("Ga");
    expect(swaraFor(60, 7).full).toBe("Ma"); // tonic G
  });
  it("C is not Sa unless C is selected", () => {
    expect(swaraFor(60, 2).base).not.toBe("Sa");
  });
  it("enharmonic notes share a swara", () => {
    expect(swaraFor(nameToMidi("C#4"), 0)).toEqual(swaraFor(nameToMidi("Db4"), 0));
  });
  it("handles octaves (saptak)", () => {
    const sa = referenceSaMidi(0);
    expect(sa).toBe(60);
    expect(saptakFor(60, sa)).toBe("madhya");
    expect(saptakFor(59, sa)).toBe("mandra");
    expect(saptakFor(72, sa)).toBe("taar");
    expect(saptakFor(47, sa)).toBe("ati-mandra");
  });
  it("label modes", () => {
    expect(labelNote(60, { mode: "western", tonicPc: 0 }).text).toBe("C");
    expect(labelNote(60, { mode: "sargam", tonicPc: 0 }).text).toBe("Sa");
    expect(labelNote(60, { mode: "both", tonicPc: 0 }).text).toBe("C — Sa");
    expect(labelNote(62, { mode: "both", tonicPc: 2 }).text).toBe("D — Sa");
    expect(labelNote(61, { mode: "both", tonicPc: 0, spelling: "flat" }).text).toBe("Db — komal Re");
  });
  it("12 swaras with tivra only on Ma", () => {
    expect(SWARAS.filter((s) => s.variant === "tivra").map((s) => s.base)).toEqual(["Ma"]);
    expect(SWARAS.filter((s) => s.variant === "komal").map((s) => s.base)).toEqual(["Re", "Ga", "Dha", "Ni"]);
  });
  it("alankar aroh is the major scale", () => {
    expect(alankarMidi(ALANKARS[0].pattern, 60).slice(0, 8)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });
});
