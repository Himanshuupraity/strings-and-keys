import { getSupabase, isSupabaseEnabled } from "@/lib/server/supabase";
import { PUSH_TABLE, vapidEnv } from "./config";
import type { ScheduleRow } from "./schedule";

/** Data access for push subscriptions (server-only). */

export interface SubscriptionRow extends ScheduleRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  learner_id: string | null;
}

export function isPushEnabled(): boolean {
  return vapidEnv() !== null && isSupabaseEnabled();
}

export async function upsertSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  reminderTime: string;
  timezone: string;
  learnerId?: string | null;
  enabled?: boolean;
}): Promise<void> {
  const { error } = await getSupabase()
    .from(PUSH_TABLE)
    .upsert(
      {
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        reminder_time: input.reminderTime,
        timezone: input.timezone,
        learner_id: input.learnerId ?? null,
        enabled: input.enabled ?? true,
      },
      { onConflict: "endpoint" },
    );
  if (error) throw error;
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  const { error } = await getSupabase().from(PUSH_TABLE).delete().eq("endpoint", endpoint);
  if (error) throw error;
}

export async function getSubscription(endpoint: string): Promise<SubscriptionRow | null> {
  const { data, error } = await getSupabase().from(PUSH_TABLE).select("endpoint,p256dh,auth,reminder_time,timezone,enabled,last_sent_on,learner_id").eq("endpoint", endpoint).maybeSingle();
  if (error) throw error;
  return (data as SubscriptionRow | null) ?? null;
}

export async function listEnabledSubscriptions(): Promise<SubscriptionRow[]> {
  const { data, error } = await getSupabase().from(PUSH_TABLE).select("endpoint,p256dh,auth,reminder_time,timezone,enabled,last_sent_on,learner_id").eq("enabled", true).limit(5000);
  if (error) throw error;
  return (data as SubscriptionRow[]) ?? [];
}

export async function markSent(endpoint: string, localDate: string): Promise<void> {
  const { error } = await getSupabase().from(PUSH_TABLE).update({ last_sent_on: localDate }).eq("endpoint", endpoint);
  if (error) throw error;
}
