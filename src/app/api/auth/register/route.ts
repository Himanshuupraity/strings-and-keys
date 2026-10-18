import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/auth/password";
import { clientIp, registerLimiter } from "@/lib/server/auth/rate-limit";
import { createSession } from "@/lib/server/auth/session";
import { jsonError, readJson, requireRemote, sameOrigin, tooMany } from "@/lib/server/auth/http";
import { RegisterSchema } from "@/lib/server/auth/validation";

export async function POST(req: Request) {
  const off = requireRemote();
  if (off) return off;
  if (!sameOrigin(req)) return jsonError(403, "Cross-site request blocked.");
  const limit = registerLimiter.check(clientIp(req));
  if (!limit.ok) return tooMany(limit.retryAfterSec);
  const body = await readJson(req, 10_000);
  if (!body.ok) return body.response;
  const parsed = RegisterSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Please check your details.");
  const { email, password, name } = parsed.data;
  const db = await getDb();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return jsonError(409, "An account with this email already exists. Try signing in instead.");
  const user = await db.user.create({ data: { email, name: name || null, passwordHash: await hashPassword(password) } });
  await createSession(user.id, req);
  return NextResponse.json({ enabled: true, user: { id: user.id, email: user.email, name: user.name, hasPassword: true, google: false } }, { status: 201 });
}
