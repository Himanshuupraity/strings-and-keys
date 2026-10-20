import { describe, expect, it } from "vitest";
import { undoDoubleSpacePeriod } from "./chords-note";

describe("undoDoubleSpacePeriod", () => {
  it("turns an automatic '. ' back into two spaces", () => {
    expect(undoDoubleSpacePeriod("[Em] ", "[Em]. ")).toBe("[Em]  ");
    expect(undoDoubleSpacePeriod("[Em] [A]", "[Em]. [A]")).toBe("[Em]  [A]");
  });
  it("keeps a period the student typed", () => {
    expect(undoDoubleSpacePeriod("end.", "end. ")).toBe("end. ");
    expect(undoDoubleSpacePeriod("end", "end.")).toBe("end.");
  });
});
