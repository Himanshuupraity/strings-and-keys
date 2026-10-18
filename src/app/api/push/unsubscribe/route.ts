import { NextResponse } from "next/server";
import { EndpointBodySchema } from "@/lib/server/push/schedule";
import { deleteSubscription, isPushEnabled } from "@/lib/server/push/store";

export const dynamic = "force-dynamic";

/** POST /api/push/unsubscribe — stop reminders for this device. */
export async function POST(req: Request) {
  if (!isPushEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  const parsed = EndpointBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await deleteSubscription(parsed.data.endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push] unsubscribe failed", e);
    return NextResponse.json({ error: "Could not remove the reminder." }, { status: 502 });
  }
}
