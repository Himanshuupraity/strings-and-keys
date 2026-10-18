import { cookies } from "next/headers";
import { getDb, isRemoteEnabled } from "@/lib/server/db";
import { hashToken, newSessionToken } from "./tokens";

export const SESSION_COOKIE = "mm_session";
export const SESSION_DAYS = 30;

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  hasPassword: boolean;
  google: boolean;
}

export function cookieSecure(req?: Request): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return req ? new URL(req.url).protocol === "https:" : false;
}

export async function createSession(userId: string, req: Request): Promise<void> {
  const db = await getDb();
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: cookieSecure(req), sameSite: "lax", path: "/", expires: expiresAt });
}

/** Signed-in user for this request, or null. Expired sessions are deleted. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  if (!isRemoteEnabled()) return null;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  const u = session.user;
  return { id: u.id, email: u.email, name: u.name, hasPassword: !!u.passwordHash, google: !!u.googleId };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token && isRemoteEnabled()) {
    const db = await getDb();
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}
