import { z } from "zod";

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8, "Use at least 8 characters.").max(200),
  name: z.string().trim().max(60).optional(),
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(200),
});
