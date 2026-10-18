import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/server/supabase";
import { getLearnerAuth, IdSchema, PinBodySchema, savePinHash } from "@/lib/server/learners";
import { hashPin, lockRemaining, tokenFor, verifyPin, verifyToken } from "@/lib/server/pin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/learners/:id/pin {currentPin?, newPin | null}
 * Set a PIN (none yet), or change / remove it — which needs the current PIN or this device's token.
 * Returns a fresh device token when a PIN is set (old tokens stop working automatically).
 */
export async function PUT(req: Request, ctx: Ctx) {
  if (!isSupabaseEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  const { id: rawId } = await ctx.params;
  const id = IdSchema.safeParse(rawId);
  if (!id.success) return NextResponse.json({ error: "Unknown learner." }, { status: 404 });
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const body = PinBodySchema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid PIN." }, { status: 400 });
  try {
    const auth = await getLearnerAuth(id.data);
    if (!auth.exists) return NextResponse.json({ error: "Unknown learner." }, { status: 404 });
    if (!auth.pinSupported) return NextResponse.json({ pinSupported: false, error: "PINs need a one-time database update (supabase/migrations/002_learner_pin.sql)." }, { status: 501 });
    if (auth.pinHash) {
      if (lockRemaining(auth) > 0) return NextResponse.json({ locked: true, error: "Locked after too many wrong PINs. Try again in a few minutes." }, { status: 429 });
      const authorised = verifyToken(id.data, auth.pinHash, req.headers.get("x-learner-token")) || (!!body.data.currentPin && verifyPin(body.data.currentPin, auth.pinHash));
      if (!authorised) return NextResponse.json({ pinRequired: true, error: "Enter your current PIN first." }, { status: 401 });
    }
    if (body.data.newPin === null) {
      await savePinHash(id.data, null);
      return NextResponse.json({ hasPin: false, token: null });
    }
    const hash = hashPin(body.data.newPin);
    await savePinHash(id.data, hash);
    return NextResponse.json({ hasPin: true, token: tokenFor(id.data, hash) });
  } catch (e) {
    console.error("[learners] pin change failed", e);
    return NextResponse.json({ error: "Could not reach the database." }, { status: 502 });
  }
}
