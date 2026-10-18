import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase access. The secret (service_role) key bypasses Row Level Security, so it
 * must never reach the browser: it is read from a non-NEXT_PUBLIC env var and this module throws
 * if bundled for the client.
 */
if (typeof window !== "undefined") throw new Error("supabase.ts must only be imported on the server");

export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return url && key ? { url, key } : null;
}

export function isSupabaseEnabled(): boolean {
  return supabaseEnv() !== null;
}

let client: SupabaseClient | null = null;
let clientFor = "";

export function getSupabase(): SupabaseClient {
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase is not configured (set SUPABASE_URL and SUPABASE_SECRET_KEY).");
  const id = env.url + env.key.slice(-6);
  if (!client || clientFor !== id) {
    client = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
    clientFor = id;
  }
  return client;
}

export const LEARNERS_TABLE = "learners";
/** Max size of one learner's progress bundle. */
export const MAX_BUNDLE_BYTES = 2 * 1024 * 1024;
