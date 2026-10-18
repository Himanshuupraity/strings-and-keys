import type { AudioExample, Exercise, Lesson, LessonStep, QuizQuestion, Visual } from "../types";

/**
 * Small builders used by levels 4–7 to keep lesson data readable.
 * They only shape plain data — the lesson player renders everything.
 */
type Extra = { hinglish?: string; audio?: AudioExample; visual?: Visual };

export const explain = (id: string, title: string, body: string, extra: Extra = {}): LessonStep => ({ id, kind: "explain", title, body, ...extra });

export const listen = (id: string, title: string, body: string, audio: AudioExample, extra: Omit<Extra, "audio"> = {}): LessonStep => ({ id, kind: "listen", title, body, audio, ...extra });

export const show = (id: string, title: string, body: string, visual: Visual, extra: Omit<Extra, "visual"> = {}): LessonStep => ({ id, kind: "visual", title, body, visual, ...extra });

export const practice = (
  id: string,
  title: string,
  body: string,
  exercise: Exercise,
  opts: { mastery?: boolean; passAccuracy?: number; hinglish?: string } = {},
): LessonStep => ({ id, kind: "exercise", title, body, exercise, ...opts });

export const selfCheck = (id: string, title: string, body: string, checklist: string[], hinglish?: string): LessonStep => ({ id, kind: "self-check", title, body, checklist, hinglish });

export const q = (id: string, question: string, options: string[], answer: number, explanation: string, extra: { audio?: AudioExample; visual?: Visual } = {}): QuizQuestion => ({
  id,
  question,
  options,
  answer,
  explanation,
  ...extra,
});

type LessonInput = Omit<Lesson, "passScore" | "minutes" | "topics"> & { passScore?: number; minutes?: number; topics?: string[] };

export const lesson = (l: LessonInput): Lesson => ({ passScore: 0.8, minutes: 10, topics: [], ...l });
