import { describe, expect, it } from "vitest";
import { STRUM_PATTERNS, strokeTimes } from "./strumming";

describe("strumming patterns", () => {
  it("computes eighth-note stroke times", () => {
    const folk = STRUM_PATTERNS.find((p) => p.id === "folk")!;
    const t = strokeTimes(folk.slots, 10, 60);
    expect(t.map((x) => x.time)).toEqual([10, 11, 11.5, 12.5, 13, 13.5]);
    expect(t.map((x) => x.stroke).join("")).toBe("DDUUDU");
  });
  it("every pattern fills its bar", () => {
    for (const p of STRUM_PATTERNS) expect(p.slots.length).toBe(p.beatsPerBar * 2);
  });
});
