import { NextResponse, connection } from "next/server";
import { cookies } from "next/headers";
import { isGoogleEnabled } from "@/lib/server/db";
import { authorizationUrl, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from "@/lib/server/auth/google";
import { pkceChallenge, randomUrlSafe } from "@/lib/server/auth/tokens";
import { cookieSecure } from "@/lib/server/auth/session";
import { disabledResponse } from "@/lib/server/auth/http";

export async function GET(req: Request) {
  await connection();
  if (!isGoogleEnabled()) return disabledResponse();
  const state = randomUrlSafe();
  const verifier = randomUrlSafe(48);
  const jar = await cookies();
  const opts = { httpOnly: true, secure: cookieSecure(req), sameSite: "lax" as const, path: "/api/auth/google", maxAge: 600 };
  jar.set(OAUTH_STATE_COOKIE, state, opts);
  jar.set(OAUTH_VERIFIER_COOKIE, verifier, opts);
  return NextResponse.redirect(authorizationUrl(req, state, pkceChallenge(verifier)));
}
