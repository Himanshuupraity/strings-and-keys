import type { QuizQuestion } from "../types";

/** Compact quiz-question builder used by curriculum files. */
export function q(id: string, question: string, options: string[], answer: number, explanation: string, extra: Partial<QuizQuestion> = {}): QuizQuestion {
  return { id, question, options, answer, explanation, ...extra };
}

/** Guitar standard-tuning MIDI notes, low E (6th string) → high E (1st string). */
export const OPEN = { E2: 40, A2: 45, D3: 50, G3: 55, B3: 59, E4: 64 } as const;

/**
 * Staff notes with optional labels (beat counts, note names). The Staff component renders `label`;
 * this helper keeps the extra field while satisfying the Visual type.
 */
export function sn(notes: { note: string; duration?: "w" | "h" | "q" | "8"; label?: string }[]): { note: string; duration?: "w" | "h" | "q" | "8" }[] {
  return notes;
}
