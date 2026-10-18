import { NextResponse } from "next/server";
import { isRemoteEnabled } from "@/lib/server/db";

export const DISABLED_MESSAGE =
  "Accounts aren't set up on this server. Your progress is saved on this device — no account needed.";

export function disabledResponse() {
  return NextResponse.json({ enabled: false, error: DISABLED_MESSAGE }, { status: 503 });
}

/** Returns a 503 response when remote mode is off, otherwise null. */
export function requireRemote(): NextResponse | null {
  return isRemoteEnabled() ? null : disabledResponse();
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export function tooMany(retryAfterSec: number) {
  return NextResponse.json({ error: "Too many attempts. Please wait a little and try again." }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });
}

/** Parse a JSON body with a byte limit. */
export async function readJson(req: Request, maxBytes: number): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return { ok: false, response: jsonError(413, "Request is too large.") };
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) return { ok: false, response: jsonError(413, "Request is too large.") };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, response: jsonError(400, "Invalid JSON.") };
  }
}

/** Basic CSRF defence for cookie-authenticated POSTs: same-origin requests only. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients / same-origin navigations without Origin
  try {
    return new URL(origin).host === new URL(req.url).host || origin === process.env.APP_URL?.replace(/\/$/, "");
  } catch {
    return false;
  }
}
