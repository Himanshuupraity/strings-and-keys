import { beforeEach, describe, expect, it } from "vitest";
import { MemoryAdapter } from "@/lib/storage/adapter";
import { setAdapter } from "@/lib/storage/db";
import { addDays, isDue, isRetired, itemId, newItem, review, MIN_EASE } from "./schedule";
import { exerciseUpdate, quizUpdates } from "./hooks";
import { revisionRepo } from "./repo";

const T = "2026-10-18";
const now = new Date(2026, 9, 18, 12);

describe("schedule (SM-2-lite)", () => {
  it("local day arithmetic crosses month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 3)).toBe("2027-01-03");
  });
  it("wrong → due tomorrow, ease drops (min 1.3), reps reset", () => {
    const i = review(newItem("quiz", "L", "q1", "theory", T, now), false, T, now);
    expect(i).toMatchObject({ due: "2026-10-19", intervalDays: 1, reps: 0, ease: 2.3, lastResult: "wrong" });
    let x = i;
    for (let k = 0; k < 10; k++) x = review(x, false, T, now);
    expect(x.ease).toBe(MIN_EASE);
  });
  it("right → 1, 3, then interval × ease", () => {
    let i = newItem("quiz", "L", "q1", "theory", T, now);
    i = review(i, true, T, now);
    expect([i.intervalDays, i.due]).toEqual([1, "2026-10-19"]);
    i = review(i, true, T, now);
    expect([i.intervalDays, i.due]).toEqual([3, "2026-10-21"]);
    i = review(i, true, T, now);
    expect(i.intervalDays).toBe(Math.round(3 * 2.5)); // 8
  });
  it("retires after 3 correct in a row once the interval reaches 14 days", () => {
    let i = newItem("quiz", "L", "q1", "theory", T, now);
    i = review(i, true, T, now); // 1
    i = review(i, true, T, now); // 3
    i = review(i, true, T, now); // 8
    expect(isRetired(i)).toBe(false);
    i = review(i, true, T, now); // 20
    expect(i.intervalDays).toBeGreaterThanOrEqual(14);
    expect(isRetired(i)).toBe(true);
    expect(isRetired(review(i, false, T, now))).toBe(false);
  });
  it("due check uses local days", () => {
    expect(isDue({ due: T }, T)).toBe(true);
    expect(isDue({ due: "2026-10-19" }, T)).toBe(false);
  });
});

describe("hooks", () => {
  const lesson = { id: "l1", track: "theory" as const, quiz: [{ id: "a" }, { id: "b" }, { id: "c" }] };
  it("wrong quiz answers create items; later right answers count as reviews", () => {
    const first = quizUpdates(lesson, ["b"], {}, T, now);
    expect(first.map((i) => i.id)).toEqual([itemId("quiz", "l1", "b")]);
    expect(first[0].due).toBe("2026-10-19");
    const existing = Object.fromEntries(first.map((i) => [i.id, i]));
    const later = quizUpdates(lesson, [], existing, "2026-10-19", now);
    expect(later).toHaveLength(1);
    expect(later[0]).toMatchObject({ lastResult: "right", reps: 1 });
  });
  it("only measured mastery exercises below the pass mark are tracked", () => {
    const step = { id: "ex", mastery: true, passAccuracy: 0.8 };
    expect(exerciseUpdate({ id: "l1", track: "piano" }, { id: "x" }, { accuracy: 0.2, measured: true }, {}, T, now)).toBeNull(); // not mastery
    expect(exerciseUpdate({ id: "l1", track: "piano" }, step, { accuracy: 0.2, measured: false }, {}, T, now)).toBeNull(); // not measured
    expect(exerciseUpdate({ id: "l1", track: "piano" }, step, { accuracy: 0.9, measured: true }, {}, T, now)).toBeNull(); // passed, nothing to revise
    const miss = exerciseUpdate({ id: "l1", track: "piano" }, step, { accuracy: 0.5, measured: true }, {}, T, now)!;
    expect(miss).toMatchObject({ kind: "exercise", refId: "ex", lastResult: "wrong" });
    const fixed = exerciseUpdate({ id: "l1", track: "piano" }, step, { accuracy: 0.9, measured: true }, { [miss.id]: miss }, T, now)!;
    expect(fixed.lastResult).toBe("right");
  });
});

describe("repo", () => {
  beforeEach(() => setAdapter(new MemoryAdapter()));
  it("saves, lists due items, and drops retired ones", async () => {
    const a = review(newItem("quiz", "l1", "a", "theory", T, now), false, T, now); // due tomorrow
    const b = { ...newItem("quiz", "l1", "b", "theory", T, now), due: "2026-10-10" }; // overdue
    await revisionRepo.saveMany([a, b]);
    expect((await revisionRepo.all()).length).toBe(2);
    expect((await revisionRepo.due(T)).map((i) => i.refId)).toEqual(["b"]);
    const retired = { ...b, reps: 3, intervalDays: 20, lastResult: "right" as const };
    await revisionRepo.saveMany([retired]);
    expect((await revisionRepo.all()).map((i) => i.refId)).toEqual(["a"]);
  });
});
