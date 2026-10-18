import webpush from "web-push";
import { vapidEnv } from "./config";

export type SendResult = "sent" | "gone" | "failed";

let configuredFor = "";

function ensureVapid() {
  const v = vapidEnv();
  if (!v) throw new Error("VAPID keys are not configured.");
  const id = v.publicKey + v.subject;
  if (configuredFor !== id) {
    webpush.setVapidDetails(v.subject, v.publicKey, v.privateKey);
    configuredFor = id;
  }
}

/** Sends one notification. "gone" means the browser unsubscribed (404/410) — delete it. */
export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: { title: string; body: string; url: string }): Promise<SendResult> {
  ensureVapid();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: "normal", topic: "practice-reminder" });
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[push] send failed", status ?? e);
    return "failed";
  }
}
