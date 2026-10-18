import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/server/supabase";
import { bundleTooLarge, getLearner, IdSchema, saveLearner, SaveBodySchema } from "@/lib/server/learners";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function idFrom(ctx: Ctx) {
  const { id } = await ctx.params;
  return IdSchema.safeParse(id);
}

/** GET /api/learners/:id — the learner's saved progress. */
export async function GET(_req: Request, ctx: Ctx) {
  if (!isSupabaseEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  const id = await idFrom(ctx);
  if (!id.success) return NextResponse.json({ error: "Unknown learner." }, { status: 404 });
  try {
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
    const r = await saveLearner(id.data, parsed.data);
    if (r.status === "not-found") return NextResponse.json({ error: "Unknown learner." }, { status: 404 });
    if (r.status === "conflict") return NextResponse.json({ conflict: true, updatedAt: r.updatedAt }, { status: 409 });
    return NextResponse.json({ updatedAt: r.updatedAt });
  } catch (e) {
    console.error("[learners] save failed", e);
    return NextResponse.json({ error: "Could not reach the database." }, { status: 502 });
  }
}
