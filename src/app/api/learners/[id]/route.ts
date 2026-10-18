import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/server/supabase";
import { bundleTooLarge, getLearner, getLearnerAuth, IdSchema, saveLearner, SaveBodySchema } from "@/lib/server/learners";
import { verifyToken } from "@/lib/server/pin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function idFrom(ctx: Ctx) {
  const { id } = await ctx.params;
  return IdSchema.safeParse(id);
}

/** When the learner has a PIN, the request must carry a valid device token (from /unlock). */
async function pinGate(req: Request, id: string): Promise<NextResponse | null> {
  const auth = await getLearnerAuth(id);
  if (!auth.exists) return NextResponse.json({ error: "Unknown learner." }, { status: 404 });
  if (auth.pinHash && !verifyToken(id, auth.pinHash, req.headers.get("x-learner-token"))) {
    return NextResponse.json({ pinRequired: true, error: "Enter this profile's PIN." }, { status: 401 });
  }
  return null;
}

/** GET /api/learners/:id — the learner's saved progress. */
export async function GET(req: Request, ctx: Ctx) {
  if (!isSupabaseEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  const id = await idFrom(ctx);
  if (!id.success) return NextResponse.json({ error: "Unknown learner." }, { status: 404 });
  try {
    const gate = await pinGate(req, id.data);
    if (gate) return gate;
    const l = await getLearner(id.data);
    if (!l) return NextResponse.json({ error: "Unknown learner." }, { status: 404 });
    return NextResponse.json({ learner: { id: l.id, name: l.name, updatedAt: l.updatedAt }, data: l.data });
  } catch (e) {
    console.error("[learners] get failed", e);
    return NextResponse.json({ error: "Could not reach the database." }, { status: 502 });
  }
}

/** PUT /api/learners/:id {bundle, baseUpdatedAt} — save progress. 409 if another device saved first. */
export async function PUT(req: Request, ctx: Ctx) {
  if (!isSupabaseEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  const id = await idFrom(ctx);
  if (!id.success) return NextResponse.json({ error: "Unknown learner." }, { status: 404 });
  const raw = await req.text();
  if (bundleTooLarge(raw)) return NextResponse.json({ error: "Progress data is too large to sync." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = SaveBodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid progress data." }, { status: 400 });
  try {
    const gate = await pinGate(req, id.data);
    if (gate) return gate;
    const r = await saveLearner(id.data, parsed.data);
    if (r.status === "not-found") return NextResponse.json({ error: "Unknown learner." }, { status: 404 });
    if (r.status === "conflict") return NextResponse.json({ conflict: true, updatedAt: r.updatedAt }, { status: 409 });
    return NextResponse.json({ updatedAt: r.updatedAt });
  } catch (e) {
    console.error("[learners] save failed", e);
    return NextResponse.json({ error: "Could not reach the database." }, { status: 502 });
  }
}
