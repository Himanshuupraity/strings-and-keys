import { z } from "zod";

/**
 * Pure scheduling logic for daily practice reminders (unit-tested, no I/O).
 * A reminder is due when the subscriber's LOCAL time (their IANA timezone) has reached their
 * chosen HH:MM today and we haven't sent one on that local date yet. This makes the cron route
 * idempotent: running it hourly, daily or every 5 minutes sends at most one reminder per day.
 */

export const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour).");

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const TimeZoneSchema = z.string().min(1).max(64).refine(isValidTimeZone, "Unknown time zone.");

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

export const SubscribeBodySchema = z.object({
  subscription: PushSubscriptionSchema,
  reminderTime: TimeSchema,
  timezone: TimeZoneSchema,
  learnerId: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
});

export const EndpointBodySchema = z.object({ endpoint: z.string().url().max(1000) });

/** Local calendar date (YYYY-MM-DD) and minutes-since-midnight in a time zone. */
export function localParts(now: Date, timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export interface ScheduleRow {
  reminder_time: string;
  timezone: string;
  enabled: boolean;
  last_sent_on: string | null;
}

export function isDue(row: ScheduleRow, now: Date): boolean {
  if (!row.enabled) return false;
  if (!isValidTimeZone(row.timezone)) return false;
  const { date, minutes } = localParts(now, row.timezone);
  if (minutes < timeToMinutes(row.reminder_time)) return false;
  return !row.last_sent_on || row.last_sent_on < date;
}

/** Which rows to notify now, plus the local date to record for each. */
export function selectDue<T extends ScheduleRow>(rows: T[], now: Date): { row: T; localDate: string }[] {
  return rows.filter((r) => isDue(r, now)).map((row) => ({ row, localDate: localParts(now, row.timezone).date }));
}

const MESSAGES = [
  { title: "🎸 10 minutes today?", body: "Your streak is waiting. One short session keeps it alive." },
  { title: "🎹 Time to practise", body: "Warm up your fingers — even 5 minutes counts." },
  { title: "🎶 Quick practice?", body: "Pick up where you left off on your dashboard." },
  { title: "🎵 Your daily riyaz", body: "A few minutes of practice today makes tomorrow easier." },
  { title: "🎸 Chord changes, anyone?", body: "Try a 1-minute chord drill and beat your best." },
];

/** Deterministic but varied per day, so the same person doesn't get the same text every day. */
export function reminderMessage(localDate: string): { title: string; body: string; url: string } {
  let h = 0;
  for (const ch of localDate) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { ...MESSAGES[h % MESSAGES.length], url: "/dashboard" };
}
