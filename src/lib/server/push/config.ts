/**
 * Server-only Web Push configuration. Reminders are enabled only when VAPID keys AND Supabase
 * are configured; otherwise every push route answers safely with enabled:false.
 */
if (typeof window !== "undefined") throw new Error("push/config.ts must only be imported on the server");

export function vapidEnv(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "";
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export function cronSecret(): string | null {
  return process.env.CRON_SECRET || null;
}

export const PUSH_TABLE = "push_subscriptions";
