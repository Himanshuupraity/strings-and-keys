import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { dummyHash, verifyPassword } from "@/lib/server/auth/password";
import { clientIp, loginLimiter } from "@/lib/server/auth/rate-limit";
import { createSession } from "@/lib/server/auth/session";
import { jsonError, readJson, requireRemote, sameOrigin, tooMany } from "@/lib/server/auth/http";
import { LoginSchema } from "@/lib/server/auth/validation";

export async function POST(req: Request) {
  const off = requireRemote();
  if (off) return off;
  if (!sameOrigin(req)) return jsonError(403, "Cross-site request blocked.");
  const ip = clientIp(req);
  const limit = loginLimiter.check(ip);
  if (!limit.ok) return tooMany(limit.retryAfterSec);
  const body = await readJson(req, 10_000);
  if (!body.ok) return body.response;
  const parsed = LoginSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, "Enter your email and password.");
  const db = await getDb();
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  // Always run a hash comparison so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !user.passwordHash || !ok) return jsonError(401, "Email or password is incorrect.");
  await createSession(user.id, req);
  return NextResponse.json({ enabled: true, user: { id: user.id, email: user.email, name: user.name, hasPassword: true, google: !!user.googleId } });
}
