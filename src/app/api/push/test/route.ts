import { NextResponse } from "next/server";
import { EndpointBodySchema } from "@/lib/server/push/schedule";
import { deleteSubscription, getSubscription, isPushEnabled } from "@/lib/server/push/store";
import { sendPush } from "@/lib/server/push/send";

export const dynamic = "force-dynamic";

const recent = new Map<string, number>();

/** POST /api/push/test — send a test notification to a subscribed device (max once per 20 s). */
export async function POST(req: Request) {
  if (!isPushEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  const parsed = EndpointBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const now = Date.now();
  if (now - (recent.get(parsed.data.endpoint) ?? 0) < 20_000) return NextResponse.json({ error: "Please wait a few seconds." }, { status: 429 });
  recent.set(parsed.data.endpoint, now);
  try {
    const sub = await getSubscription(parsed.data.endpoint);
    if (!sub) return NextResponse.json({ error: "This device isn't subscribed yet." }, { status: 404 });
    const r = await sendPush(sub, { title: "🎶 Test reminder", body: "Reminders are working. See you at practice time!", url: "/dashboard" });
    if (r === "gone") {
      await deleteSubscription(sub.endpoint);
      return NextResponse.json({ error: "This device's subscription expired. Turn reminders off and on again." }, { status: 410 });
    }
    if (r === "failed") return NextResponse.json({ error: "The notification service didn't accept it. Try again later." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push] test failed", e);
    return NextResponse.json({ error: "Could not send the test." }, { status: 502 });
  }
}
