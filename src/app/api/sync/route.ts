import { NextResponse, connection } from "next/server";
import { getDb } from "@/lib/server/db";
import { readServerBundle, writeRows } from "@/lib/server/db/sync";
import {
  MAX_BUNDLE_BYTES,
  SyncPostSchema,
  planSync,
  rowsToWrite,
  toExportBundle,
  validateBundle,
} from "@/lib/server/db/sync-mapping";
import { getCurrentUser } from "@/lib/server/auth/session";
import { clientIp, syncLimiter } from "@/lib/server/auth/rate-limit";
import { jsonError, readJson, requireRemote, sameOrigin, tooMany } from "@/lib/server/auth/http";
import { SCHEMA_VERSION } from "@/lib/storage/schemas";

/** GET: the signed-in user's server copy, in the device ExportBundle format. */
export async function GET() {
  await connection();
  const off = requireRemote();
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Please sign in first.");
  const db = await getDb();
  const { bundle, prefs } = await readServerBundle(db, user.id);
  return NextResponse.json(toExportBundle(bundle, prefs, SCHEMA_VERSION), { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST { bundle, strategy?, dryRun? }
 *  - dryRun: only returns the plan (added / identical / conflicts).
 *  - Without a strategy, conflicting rows are NOT written: responds 409 with the plan so the
 *    student can choose "keep-server" or "keep-uploaded". New rows never overwrite anything.
 */
export async function POST(req: Request) {
  const off = requireRemote();
  if (off) return off;
  if (!sameOrigin(req)) return jsonError(403, "Cross-site request blocked.");
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Please sign in first.");
  const limit = syncLimiter.check(`${user.id}:${clientIp(req)}`);
  if (!limit.ok) return tooMany(limit.retryAfterSec);

  const body = await readJson(req, MAX_BUNDLE_BYTES);
  if (!body.ok) return body.response;
  const envelope = SyncPostSchema.safeParse(body.data);
  if (!envelope.success) return jsonError(400, "Expected { bundle, strategy?, dryRun? }.");

  let validated;
  try {
    validated = validateBundle(envelope.data.bundle);
  } catch (e) {
    return jsonError(400, e instanceof Error && e.message.startsWith("Too many") ? e.message : "That doesn't look like a Melody Masters backup.");
  }

  const db = await getDb();
  const server = await readServerBundle(db, user.id);
  const plan = planSync(server.bundle, validated.bundle);
  const rejected = validated.rejected;

  if (envelope.data.dryRun) return NextResponse.json({ plan, rejected });
  const strategy = envelope.data.strategy;
  if (!strategy && plan.conflicts.length > 0) return NextResponse.json({ error: "Some items differ between this device and your account. Choose which copy to keep.", plan, rejected }, { status: 409 });

  const rows = rowsToWrite(server.bundle, validated.bundle, strategy ?? "keep-server");
  // Preferences follow the same rule: only replace the server copy when explicitly asked.
  const prefs = validated.prefs && (strategy === "keep-uploaded" || server.prefs == null) ? validated.prefs : null;
  const written = await writeRows(db, user.id, rows, prefs);
  return NextResponse.json({ ok: true, plan, written, rejected });
}
