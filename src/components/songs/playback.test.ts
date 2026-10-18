import { describe, expect, it } from "vitest";
import { buildTimeline, chordAt, judgeMelodyHit, pianoAccompaniment, simplifyChord, strumAccompaniment } from "./playback";
import { getSong } from "@/content/songs";

const opts = { transpose: 0, simplify: false, sectionId: null };

describe("song playback helpers", () => {
  it("simplifies chords to triads", () => {
    expect(simplifyChord("G7")).toBe("G");
    expect(simplifyChord("Am7")).toBe("Am");
    expect(simplifyChord("Cmaj7")).toBe("C");
    expect(simplifyChord("Em")).toBe("Em");
  });
  it("builds a timeline with a negative-start pickup", () => {
    const tl = buildTimeline(getSong("happy-birthday")!, opts);
    expect(tl.startBeat).toBe(-1);
    expect(tl.length).toBe(24);
    expect(chordAt(tl, 0).current?.chord).toBe("C");
    expect(chordAt(tl, 3).current?.chord).toBe("G7");
  });
  it("transposes chords and melody together", () => {
    const tl = buildTimeline(getSong("twinkle-twinkle")!, { ...opts, transpose: 7 });
    expect(tl.chords[0].chord).toBe("G");
    expect(tl.notes[0].midi).toBe(67);
  });
  it("loops a single section", () => {
    const tl = buildTimeline(getSong("ode-to-joy")!, { ...opts, sectionId: "b" });
    expect(tl.length).toBe(16);
    expect(tl.chords[0].chord).toBe("G");
  });
  it("accompaniment patterns", () => {
    expect(pianoAccompaniment("C", 4, "alberti").map((e) => e.midis[0])).toEqual([48, 67, 64, 67, 48, 67, 64, 67]);
    expect(pianoAccompaniment("C", 4, "block")[0].midis).toEqual([48, 60, 64, 67]);
    expect(strumAccompaniment("G", 4, "D-DU-UDU").map((e) => e.direction)).toEqual(["down", "down", "up", "up", "down", "up"]);
  });
  it("judges play-along hits", () => {
    const tl = buildTimeline(getSong("twinkle-twinkle")!, opts);
    expect(judgeMelodyHit(tl, 2.1, 67).correct).toBe(true);
    expect(judgeMelodyHit(tl, 2.1, 65).correct).toBe(false);
  });
});
