import { z } from "zod";
import { ExportSchema } from "@/lib/storage/schemas";
import { LearnerNameSchema, nameKey } from "@/lib/learner/names";
import { getSupabase, LEARNERS_TABLE, MAX_BUNDLE_BYTES } from "./supabase";

/** Data access for learner profiles. Pure DB logic; HTTP concerns live in the route handlers. */

export interface LearnerSummary {
  id: string;
  name: string;
  updatedAt: string;
  /** Protected with a 4-digit PIN. */
  hasPin?: boolean;
}

export const IdSchema = z.string().uuid();
export const CreateBodySchema = z.object({ name: LearnerNameSchema });
export const UnlockBodySchema = z.object({ pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits") });
export const PinBodySchema = z.object({
  currentPin: z.string().regex(/^\d{4}$/).optional(),
  newPin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits").nullable(),
});

export const SaveBodySchema = z.object({
  bundle: ExportSchema,
  /** updated_at the client last synced from; a newer server copy means another device saved first. */
  baseUpdatedAt: z.string().nullable().optional(),
  force: z.boolean().optional(),
});

type Row = { id: string; name: string; updated_at: string; data?: unknown; pin_hash?: string | null };
const summary = (r: Row): LearnerSummary => ({ id: r.id, name: r.name, updatedAt: r.updated_at, hasPin: !!r.pin_hash });

/**
 * True when Postgres/PostgREST says the PIN columns don't exist yet — i.e. the user hasn't run
 * supabase/migrations/002_learner_pin.sql. Everything keeps working without PINs in that case.
 */
export function isMissingPinColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "42703" || err.code === "PGRST204" || /pin_(hash|attempts|locked_until)/.test(err.message ?? "");
}

export async function listLearners(): Promise<{ learners: LearnerSummary[]; pinSupported: boolean }> {
  const db = getSupabase();
  const withPin = await db.from(LEARNERS_TABLE).select("id,name,updated_at,pin_hash").order("updated_at", { ascending: false }).limit(200);
  if (!withPin.error) return { learners: (withPin.data as Row[]).map(summary), pinSupported: true };
  if (!isMissingPinColumn(withPin.error)) throw withPin.error;
  const { data, error } = await db.from(LEARNERS_TABLE).select("id,name,updated_at").order("updated_at", { ascending: false }).limit(200);
  if (error) throw error;
  return { learners: (data as Row[]).map(summary), pinSupported: false };
}

export interface LearnerAuth {
  pinSupported: boolean;
  exists: boolean;
  pinHash: string | null;
  attempts: number;
  lockedUntil: number | null;
}

/** PIN state for one learner (never sent to the browser). */
export async function getLearnerAuth(id: string): Promise<LearnerAuth> {
  const db = getSupabase();
  const r = await db.from(LEARNERS_TABLE).select("id,pin_hash,pin_attempts,pin_locked_until").eq("id", id).maybeSingle();
  if (r.error) {
    if (!isMissingPinColumn(r.error)) throw r.error;
    const plain = await db.from(LEARNERS_TABLE).select("id").eq("id", id).maybeSingle();
    if (plain.error) throw plain.error;
    return { pinSupported: false, exists: !!plain.data, pinHash: null, attempts: 0, lockedUntil: null };
  }
  const row = r.data as { pin_hash: string | null; pin_attempts: number | null; pin_locked_until: string | null } | null;
  return {
    pinSupported: true,
    exists: !!row,
    pinHash: row?.pin_hash ?? null,
    attempts: row?.pin_attempts ?? 0,
    lockedUntil: row?.pin_locked_until ? new Date(row.pin_locked_until).getTime() : null,
  };
}

export async function saveAttemptState(id: string, attempts: number, lockedUntil: number | null) {
  const { error } = await getSupabase()
    .from(LEARNERS_TABLE)
    .update({ pin_attempts: attempts, pin_locked_until: lockedUntil ? new Date(lockedUntil).toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function savePinHash(id: string, pinHash: string | null) {
  const { error } = await getSupabase().from(LEARNERS_TABLE).update({ pin_hash: pinHash, pin_attempts: 0, pin_locked_until: null }).eq("id", id);
  if (error) throw error;
}

/** Creates a learner, or returns the existing one with the same name (case-insensitive). */
export async function createOrFindLearner(name: string): Promise<{ learner: LearnerSummary; existed: boolean }> {
  const db = getSupabase();
  const key = nameKey(name);
  let found = await db.from(LEARNERS_TABLE).select("id,name,updated_at,pin_hash").eq("name_key", key).maybeSingle();
  if (found.error && isMissingPinColumn(found.error)) found = await db.from(LEARNERS_TABLE).select("id,name,updated_at").eq("name_key", key).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return { learner: summary(found.data as Row), existed: true };
  const ins = await db.from(LEARNERS_TABLE).insert({ name, name_key: key, data: null }).select("id,name,updated_at").single();
  if (ins.error) {
    // Unique violation: created by another device a moment ago.
    if (ins.error.code === "23505") {
      const again = await db.from(LEARNERS_TABLE).select("id,name,updated_at").eq("name_key", key).single();
      if (again.error) throw again.error;
      return { learner: summary(again.data as Row), existed: true };
    }
    throw ins.error;
  }
  return { learner: summary(ins.data as Row), existed: false };
}

export async function getLearner(id: string): Promise<(LearnerSummary & { data: unknown }) | null> {
  const { data, error } = await getSupabase().from(LEARNERS_TABLE).select("id,name,updated_at,data").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? { ...summary(data as Row), data: (data as Row).data ?? null } : null;
}

export type SaveResult = { status: "saved"; updatedAt: string } | { status: "conflict"; updatedAt: string } | { status: "not-found" };

export async function saveLearner(id: string, body: z.infer<typeof SaveBodySchema>): Promise<SaveResult> {
  const db = getSupabase();
  const cur = await db.from(LEARNERS_TABLE).select("updated_at").eq("id", id).maybeSingle();
  if (cur.error) throw cur.error;
  if (!cur.data) return { status: "not-found" };
  const serverAt = (cur.data as { updated_at: string }).updated_at;
  if (!body.force && body.baseUpdatedAt !== undefined && body.baseUpdatedAt !== null && new Date(serverAt).getTime() > new Date(body.baseUpdatedAt).getTime()) {
    return { status: "conflict", updatedAt: serverAt };
  }
  const upd = await db.from(LEARNERS_TABLE).update({ data: body.bundle, updated_at: new Date().toISOString() }).eq("id", id).select("updated_at").single();
  if (upd.error) throw upd.error;
  return { status: "saved", updatedAt: (upd.data as { updated_at: string }).updated_at };
}

export function bundleTooLarge(raw: string): boolean {
  return new TextEncoder().encode(raw).length > MAX_BUNDLE_BYTES + 4096;
}

/** Tiny in-memory limiter (per server instance) to stop accidental floods of new profiles. */
const hits = new Map<string, number[]>();
export function allowRequest(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
