import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/server/supabase";
import { allowRequest, clientIp, getLearnerAuth, IdSchema, saveAttemptState, UnlockBodySchema } from "@/lib/server/learners";
import { afterAttempt, lockRemaining, tokenFor, verifyPin } from "@/lib/server/pin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NOT_SUPPORTED = { pinSupported: false, error: "PINs need a one-time database update (supabase/migrations/002_learner_pin.sql)." };

/** POST /api/learners/:id/unlock {pin} → { token } for this device. 5 wrong tries lock it for 5 minutes. */
export async function POST(req: Request, ctx: Ctx) {
  if (!isSupabaseEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  const { id: rawId } = await ctx.params;
  const id = IdSchema.safeParse(rawId);
  if (!id.success) return NextResponse.json({ error: "Unknown learner." }, { status: 404 });
  if (!allowRequest(`unlock:${clientIp(req)}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts from this network. Try again later." }, { status: 429, headers: { "Retry-After": "600" } });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const body = UnlockBodySchema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "PIN must be 4 digits." }, { status: 400 });
  try {
    const auth = await getLearnerAuth(id.data);
    if (!auth.exists) return NextResponse.json({ error: "Unknown learner." }, { status: 404 });
    if (!auth.pinSupported) return NextResponse.json(NOT_SUPPORTED, { status: 501 });
    if (!auth.pinHash) return NextResponse.json({ token: null, hasPin: false });
    const wait = lockRemaining(auth);
    if (wait > 0) {
      const secs = Math.ceil(wait / 1000);
      return NextResponse.json({ locked: true, retryAfter: secs, error: `Too many wrong PINs. Try again in ${Math.ceil(secs / 60)} min.` }, { status: 429, headers: { "Retry-After": String(secs) } });
    }
    const ok = verifyPin(body.data.pin, auth.pinHash);
    const next = afterAttempt(auth, ok);
    await saveAttemptState(id.data, next.attempts, next.lockedUntil);
    if (ok) return NextResponse.json({ token: tokenFor(id.data, auth.pinHash), hasPin: true });
    if (next.locked) {
      const secs = Math.ceil(lockRemaining(next) / 1000);
      return NextResponse.json({ locked: true, retryAfter: secs, error: "Too many wrong PINs. Locked for 5 minutes." }, { status: 429, headers: { "Retry-After": String(secs) } });
    }
    return NextResponse.json({ error: "Wrong PIN.", attemptsLeft: next.attemptsLeft }, { status: 403 });
  } catch (e) {
    console.error("[learners] unlock failed", e);
    return NextResponse.json({ error: "Could not reach the database." }, { status: 502 });
  }
}
