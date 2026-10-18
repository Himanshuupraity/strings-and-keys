import { NextResponse, connection } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { getDb, isGoogleEnabled } from "@/lib/server/db";
import { appOrigin, exchangeCode, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from "@/lib/server/auth/google";
import { createSession } from "@/lib/server/auth/session";
import { disabledResponse } from "@/lib/server/auth/http";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: Request) {
  await connection();
  if (!isGoogleEnabled()) return disabledResponse();
  const url = new URL(req.url);
  const back = (status: string) => NextResponse.redirect(`${appOrigin(req)}/settings?account=${status}`);
  const jar = await cookies();
  const state = jar.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = jar.get(OAUTH_VERIFIER_COOKIE)?.value;
  jar.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth/google" });
  jar.delete({ name: OAUTH_VERIFIER_COOKIE, path: "/api/auth/google" });
  const code = url.searchParams.get("code");
  const returned = url.searchParams.get("state");
  if (!code || !state || !verifier || !returned || !safeEqual(state, returned)) return back("google-error");
  try {
    const g = await exchangeCode(req, code, verifier);
    if (g.email_verified === false) return back("google-unverified");
    const db = await getDb();
    const email = g.email.toLowerCase();
    let user = await db.user.findUnique({ where: { googleId: g.sub } });
    if (!user) {
      const byEmail = await db.user.findUnique({ where: { email } });
      // Link only verified Google emails to an existing account with the same address.
      user = byEmail
        ? await db.user.update({ where: { id: byEmail.id }, data: { googleId: g.sub, name: byEmail.name ?? g.name ?? null } })
        : await db.user.create({ data: { email, googleId: g.sub, name: g.name ?? null } });
    }
    await createSession(user.id, req);
    return back("google-ok");
  } catch {
    return back("google-error");
  }
}
