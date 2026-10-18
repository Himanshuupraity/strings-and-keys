import { z } from "zod";

/** Google OAuth 2.0 authorization-code flow with PKCE + state. */
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const OAUTH_STATE_COOKIE = "mm_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "mm_oauth_verifier";

export function appOrigin(req: Request): string {
  return (process.env.APP_URL?.replace(/\/$/, "") || new URL(req.url).origin);
}

export function redirectUri(req: Request): string {
  return `${appOrigin(req)}/api/auth/google/callback`;
}

export function authorizationUrl(req: Request, state: string, challenge: string): string {
  const u = new URL(GOOGLE_AUTH_URL);
  u.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return u.toString();
}

const TokenResponse = z.object({ access_token: z.string() });
const UserInfo = z.object({ sub: z.string(), email: z.string(), email_verified: z.boolean().optional(), name: z.string().optional() });
export type GoogleUser = z.infer<typeof UserInfo>;

export async function exchangeCode(req: Request, code: string, verifier: string): Promise<GoogleUser> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(req),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const { access_token } = TokenResponse.parse(await res.json());
  const info = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!info.ok) throw new Error(`Google userinfo failed (${info.status})`);
  return UserInfo.parse(await info.json());
}
