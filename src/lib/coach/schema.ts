import { z } from "zod";

/**
 * Request body for POST /api/coach. Deliberately contains no personal data (no names, emails or
 * profile fields) — only the conversation and the practice context needed for teaching.
 */
export const MAX_MESSAGES = 20;
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_BODY_BYTES = 64 * 1024;

export const CoachMessageInSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});

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

export const CoachRequestSchema = z
  .object({
    messages: z.array(CoachMessageInSchema).min(1).max(MAX_MESSAGES),
    context: CoachContextSchema,
  })
  .refine((b) => b.messages.at(-1)?.role === "user", { message: "Last message must be from the user", path: ["messages"] });

export type CoachRequest = z.infer<typeof CoachRequestSchema>;
export type CoachContext = z.infer<typeof CoachContextSchema>;
export type LastExercise = z.infer<typeof LastExerciseSchema>;

export interface CoachResponse {
  reply: string;
  source: "llm" | "rules";
  /** Why the rules fallback was used, if it was. */
  fallbackReason?: "not-configured" | "provider-error" | "refused";
}

export interface CoachStatus {
  configured: boolean;
  provider: string | null;
  model: string | null;
  reason?: string;
}
