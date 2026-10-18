import { z } from "zod";
import { ExportSchema } from "@/lib/storage/schemas";
import { LearnerNameSchema, nameKey } from "@/lib/learner/names";
import { getSupabase, LEARNERS_TABLE, MAX_BUNDLE_BYTES } from "./supabase";

/** Data access for learner profiles. Pure DB logic; HTTP concerns live in the route handlers. */

export interface LearnerSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export const IdSchema = z.string().uuid();
export const CreateBodySchema = z.object({ name: LearnerNameSchema });
export const SaveBodySchema = z.object({
  bundle: ExportSchema,
  /** updated_at the client last synced from; a newer server copy means another device saved first. */
  baseUpdatedAt: z.string().nullable().optional(),
  force: z.boolean().optional(),
});

type Row = { id: string; name: string; updated_at: string; data?: unknown };
const summary = (r: Row): LearnerSummary => ({ id: r.id, name: r.name, updatedAt: r.updated_at });

export async function listLearners(): Promise<LearnerSummary[]> {
  const { data, error } = await getSupabase().from(LEARNERS_TABLE).select("id,name,updated_at").order("updated_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data as Row[]).map(summary);
}

/** Creates a learner, or returns the existing one with the same name (case-insensitive). */
export async function createOrFindLearner(name: string): Promise<{ learner: LearnerSummary; existed: boolean }> {
  const db = getSupabase();
  const key = nameKey(name);
  const found = await db.from(LEARNERS_TABLE).select("id,name,updated_at").eq("name_key", key).maybeSingle();
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
