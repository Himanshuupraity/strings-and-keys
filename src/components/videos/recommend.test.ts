import { describe, expect, it } from "vitest";
import { recommendVideos } from "./recommend";
import { VIDEOS } from "@/content/videos";

describe("video recommendations", () => {
  it("matches lesson topics and instrument", () => {
    const r = recommendVideos(VIDEOS, { instrument: "guitar", topics: ["tuning", "guitar-beginner"] });
    expect(r[0].topics).toContain("tuning");
    expect(r.every((v) => v.instrument !== "piano")).toBe(true);
  });
  it("never recommends the other instrument", () => {
    const r = recommendVideos(VIDEOS, { instrument: "piano", topics: ["chords"] }, 10);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((v) => v.instrument !== "guitar")).toBe(true);
  });
  it("de-prioritises watched videos", () => {
    const first = recommendVideos(VIDEOS, { instrument: "guitar", topics: ["chords"] })[0];
    const again = recommendVideos(VIDEOS, { instrument: "guitar", topics: ["chords"], watched: new Set([first.id]) })[0];
    expect(again.id).not.toBe(first.id);
  });
});
