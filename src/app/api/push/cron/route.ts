import { NextResponse } from "next/server";
import { cronSecret } from "@/lib/server/push/config";
import { runReminderPass } from "@/lib/server/push/cron";
import { deleteSubscription, isPushEnabled, listEnabledSubscriptions, markSent } from "@/lib/server/push/store";
import { sendPush } from "@/lib/server/push/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/push/cron — sends today's reminders. Called by Vercel Cron (which sends
 * "Authorization: Bearer $CRON_SECRET") or any external scheduler. Idempotent: each device gets
 * at most one reminder per local day, so it's safe to call as often as you like.
 */
export async function GET(req: Request) {
  const secret = cronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isPushEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  try {
    const result = await runReminderPass({
      list: listEnabledSubscriptions,
      send: (row, payload) => sendPush(row, payload),
      markSent,
      remove: deleteSubscription,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[push] cron failed", e);
    return NextResponse.json({ error: "Reminder run failed." }, { status: 502 });
  }
}
