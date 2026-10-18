import { NextResponse } from "next/server";
import { vapidEnv } from "@/lib/server/push/config";
import { isPushEnabled } from "@/lib/server/push/store";

export const dynamic = "force-dynamic";

/** GET /api/push/config — whether reminders can work here, plus the public VAPID key. */
export async function GET() {
  if (!isPushEnabled()) return NextResponse.json({ enabled: false, publicKey: null });
  return NextResponse.json({ enabled: true, publicKey: vapidEnv()!.publicKey });
}
