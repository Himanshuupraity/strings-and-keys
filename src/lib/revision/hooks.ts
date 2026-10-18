import type { RevisionItem, Track } from "@/lib/storage/schemas";
import { itemId, localDay, newItem, review } from "./schedule";

/**
 * Pure functions that turn lesson results into revision-item updates.
 * Returns the items to save (existing items are reviewed; new mistakes create items).
 */
export function quizUpdates(
  lesson: { id: string; track: Track; quiz: { id: string }[] },
  wrongIds: string[],
  existing: Record<string, RevisionItem>,
  today = localDay(),
  now = new Date(),
): RevisionItem[] {
  const out: RevisionItem[] = [];
  for (const q of lesson.quiz) {
    const id = itemId("quiz", lesson.id, q.id);
    const prev = existing[id];
    const wrong = wrongIds.includes(q.id);
    if (wrong) out.push(review(prev ?? newItem("quiz", lesson.id, q.id, lesson.track, today, now), false, today, now));
    else if (prev) out.push(review(prev, true, today, now)); // answering it right later counts as a review
  }
  return out;
}

/** Only measured mastery exercises are tracked. Below the pass mark = a mistake to revise. */
export function exerciseUpdate(
  lesson: { id: string; track: Track },
  step: { id: string; mastery?: boolean; passAccuracy?: number },
  outcome: { accuracy: number; measured: boolean },
  existing: Record<string, RevisionItem>,
  today = localDay(),
  now = new Date(),
): RevisionItem | null {
  if (!step.mastery || !outcome.measured) return null;
  const id = itemId("exercise", lesson.id, step.id);
  const prev = existing[id];
  const passed = outcome.accuracy >= (step.passAccuracy ?? 0.8);
  if (!passed) return review(prev ?? newItem("exercise", lesson.id, step.id, lesson.track, today, now), false, today, now);
  return prev ? review(prev, true, today, now) : null;
}
