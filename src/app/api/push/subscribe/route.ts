import { NextResponse } from "next/server";
import { SubscribeBodySchema } from "@/lib/server/push/schedule";
import { isPushEnabled, upsertSubscription } from "@/lib/server/push/store";

export const dynamic = "force-dynamic";

/** POST /api/push/subscribe — save (or update) this device's reminder subscription. */
export async function POST(req: Request) {
  if (!isPushEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  const raw = await req.text();
  if (raw.length > 8000) return NextResponse.json({ error: "Too large." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = SubscribeBodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid subscription." }, { status: 400 });
  const b = parsed.data;
  try {
    await upsertSubscription({ endpoint: b.subscription.endpoint, p256dh: b.subscription.keys.p256dh, auth: b.subscription.keys.auth, reminderTime: b.reminderTime, timezone: b.timezone, learnerId: b.learnerId ?? null, enabled: b.enabled ?? true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push] subscribe failed", e);
    return NextResponse.json({ error: "Could not save the reminder." }, { status: 502 });
  }
}
