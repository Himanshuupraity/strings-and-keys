import { z } from "zod";

/** Practice context the built-in coach uses to tailor its answers. Contains no personal data. */
export const MAX_MESSAGE_CHARS = 2000;

export const LastExerciseSchema = z.object({
  exerciseId: z.string().max(100),
  accuracy: z.number().min(0).max(1),
  input: z.enum(["virtual", "midi", "mic", "self", "tap"]),
  measured: z.boolean(),
  mistakes: z.string().max(400).optional(),
});

export const CoachContextSchema = z.object({
  instrument: z.enum(["guitar", "piano"]),
  lessonId: z.string().max(100).optional(),
  lessonTitle: z.string().max(160).optional(),
  level: z.number().int().min(0).max(7).optional(),
  lastExercise: LastExerciseSchema.optional(),
  skillsWeak: z.array(z.string().max(80)).max(10).optional(),
  hinglish: z.boolean().optional(),
});

export type CoachContext = z.infer<typeof CoachContextSchema>;
export type LastExercise = z.infer<typeof LastExerciseSchema>;
