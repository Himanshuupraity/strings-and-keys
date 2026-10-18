import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/server/supabase";
import { allowRequest, clientIp, createOrFindLearner, CreateBodySchema, listLearners } from "@/lib/server/learners";

export const dynamic = "force-dynamic";

const disabled = () => NextResponse.json({ enabled: false, learners: [] });

/** GET /api/learners — names shown on the "Who's learning?" screen. */
export async function GET() {
  if (!isSupabaseEnabled()) return disabled();
  try {
    const { learners, pinSupported } = await listLearners();
    return NextResponse.json({ enabled: true, pinSupported, learners });
  } catch (e) {
    console.error("[learners] list failed", e);
    return NextResponse.json({ enabled: true, error: "Could not reach the database." }, { status: 502 });
  }
}

/** POST /api/learners {name} — create a learner, or return the existing one with that name. */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  if (!allowRequest(`create:${clientIp(req)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many new profiles from this network. Try again in a few minutes." }, { status: 429, headers: { "Retry-After": "600" } });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = CreateBodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid name." }, { status: 400 });
  try {
    const r = await createOrFindLearner(parsed.data.name);
    return NextResponse.json({ enabled: true, ...r }, { status: r.existed ? 200 : 201 });
  } catch (e) {
    console.error("[learners] create failed", e);
    return NextResponse.json({ error: "Could not save your name. Check the Supabase setup." }, { status: 502 });
  }
}
