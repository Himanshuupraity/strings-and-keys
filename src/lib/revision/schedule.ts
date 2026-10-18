import type { RevisionItem } from "@/lib/storage/schemas";
import type { Track } from "@/lib/storage/schemas";

/**
 * SM-2-lite spaced revision (pure, unit-tested).
 *  - Wrong → due tomorrow: interval 1 day, ease −0.2 (minimum 1.3), consecutive-correct count resets.
 *  - Right → interval 1 → 3 → interval × ease.
 *  - An item retires after 3 consecutive correct reviews once its interval has reached 14+ days.
 * Dates are local calendar days ("YYYY-MM-DD").
 */
export const MIN_EASE = 1.3;
export const START_EASE = 2.5;
export const RETIRE_REPS = 3;
export const RETIRE_INTERVAL = 14;

export function localDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

export function itemId(kind: RevisionItem["kind"], lessonId: string, refId: string): string {
  return `${kind}:${lessonId}:${refId}`;
}

export function isDue(item: Pick<RevisionItem, "due">, today = localDay()): boolean {
  return item.due <= today;
}

/** Whether the item should leave the queue (learnt well enough). */
export function isRetired(item: Pick<RevisionItem, "reps" | "intervalDays" | "lastResult">): boolean {
  return item.lastResult === "right" && item.reps >= RETIRE_REPS && item.intervalDays >= RETIRE_INTERVAL;
}

export function newItem(kind: RevisionItem["kind"], lessonId: string, refId: string, track: Track, today = localDay(), now = new Date()): RevisionItem {
  return {
    id: itemId(kind, lessonId, refId),
    kind,
    lessonId,
    refId,
    track,
    ease: START_EASE,
    intervalDays: 0,
    reps: 0,
    due: today,
    lastResult: "wrong",
    updatedAt: now.toISOString(),
  };
}

/** Apply one result to an item and reschedule it. */
export function review(item: RevisionItem, correct: boolean, today = localDay(), now = new Date()): RevisionItem {
  if (!correct) {
    return { ...item, ease: Math.max(MIN_EASE, +(item.ease - 0.2).toFixed(2)), intervalDays: 1, reps: 0, due: addDays(today, 1), lastResult: "wrong", updatedAt: now.toISOString() };
  }
  const reps = item.reps + 1;
  const intervalDays = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(Math.max(item.intervalDays, 1) * item.ease);
  return { ...item, reps, intervalDays, due: addDays(today, intervalDays), lastResult: "right", updatedAt: now.toISOString() };
}
