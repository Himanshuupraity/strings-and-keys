import { z } from "zod";

export const MAX_NAME_LENGTH = 40;

/** Collapse spaces and trim, keeping the learner's own capitalisation. */
export function cleanName(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** Key used for uniqueness: "Asha", " asha " and "ASHA" are the same learner. */
export function nameKey(raw: string): string {
  return cleanName(raw).toLocaleLowerCase();
}

export const LearnerNameSchema = z
  .string()
  .transform(cleanName)
  .pipe(
    z
      .string()
      .min(1, "Please enter your name.")
      .max(MAX_NAME_LENGTH, `Please keep it under ${MAX_NAME_LENGTH} characters.`)
      .regex(/^[\p{L}\p{M}\p{N} .'’-]+$/u, "Use letters, numbers, spaces, apostrophes, dots or hyphens."),
  );

export function initials(name: string): string {
  const parts = cleanName(name).split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toLocaleUpperCase();
}
