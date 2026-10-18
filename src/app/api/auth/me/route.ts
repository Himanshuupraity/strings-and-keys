import { NextResponse, connection } from "next/server";
import { isGoogleEnabled, isRemoteEnabled } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth/session";

/**
 * Always 200 so the settings page can ask "are accounts available?" without an error:
 * { enabled: false, user: null } in local-first mode.
 */
export async function GET() {
  await connection(); // never prerender: depends on env + cookies at request time
  if (!isRemoteEnabled()) return NextResponse.json({ enabled: false, google: false, user: null });
  try {
    return NextResponse.json({ enabled: true, google: isGoogleEnabled(), user: await getCurrentUser() });
  } catch {
    return NextResponse.json({ enabled: true, google: isGoogleEnabled(), user: null, error: "The account server is unreachable right now." }, { status: 503 });
  }
}
