import { NextResponse } from "next/server";
import { destroySession } from "@/lib/server/auth/session";
import { jsonError, requireRemote, sameOrigin } from "@/lib/server/auth/http";

export async function POST(req: Request) {
  const off = requireRemote();
  if (off) return off;
  if (!sameOrigin(req)) return jsonError(403, "Cross-site request blocked.");
  await destroySession();
  return NextResponse.json({ ok: true });
}
