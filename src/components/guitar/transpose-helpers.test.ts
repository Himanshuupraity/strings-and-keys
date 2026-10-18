import { describe, expect, it } from "vitest";
import { parseProgressionInput, soundingName } from "./transpose-helpers";

describe("transposer helpers", () => {
  it("spells sounding chords conventionally", () => {
    expect(soundingName("G", 3)).toBe("Bb");
    expect(soundingName("Em", 3)).toBe("Gm");
    expect(soundingName("D", 2)).toBe("E");
    expect(soundingName("C", 1)).toBe("Db");
    expect(soundingName("A", 1)).toBe("Bb");
  });
  it("parses progression text", () => {
    expect(parseProgressionInput("F, Bb – C  Hm")).toEqual({ chords: ["F", "Bb", "C"], invalid: ["Hm"] });
  });
});
