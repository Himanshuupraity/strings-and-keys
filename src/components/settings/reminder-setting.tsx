"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BellRing, Share, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button, Callout, Card, CardBody, CardHeader, Field, Input, Switch } from "@/components/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { loadLearner } from "@/lib/learner/store";

type PushConfig = { enabled: boolean; publicKey: string | null } | null;

function base64UrlToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Environment facts that only exist in the browser (read after hydration). */
function useClientEnv() {
  return useSyncExternalStore(
    () => () => {},
    () => {
      const ua = navigator.userAgent;
      const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      return JSON.stringify({ ios, standalone, supported, permission: "Notification" in window ? Notification.permission : "unsupported" });
    },
    () => JSON.stringify({ ios: false, standalone: false, supported: false, permission: "default" }),
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  // In development a service worker would cache dev bundles and serve stale code.
  if (process.env.NODE_ENV !== "production") throw new Error("Reminders need the deployed (production) app.");
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

/**
 * Daily practice reminder (Web Push). Works on Android/desktop Chrome, and on iPhone once the app
 * is added to the Home Screen (iOS 16.4+). Needs the deployed site to have VAPID keys configured.
 */
export function ReminderSetting() {
  const [prefs, setPrefs] = usePrefs();
  const env = JSON.parse(useClientEnv()) as { ios: boolean; standalone: boolean; supported: boolean; permission: NotificationPermission | "unsupported" };
  const [config, setConfig] = useState<PushConfig>(null);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<string | null>(null);
  const perm = permission ?? env.permission;

  useEffect(() => {
    let alive = true;
    fetch("/api/push/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((c: PushConfig) => alive && setConfig(c))
      .catch(() => alive && setConfig({ enabled: false, publicKey: null }));
    return () => {
      alive = false;
    };
  }, []);

  const needsHomeScreen = env.ios && !env.standalone;
  const canSubscribe = env.supported && !!config?.enabled && !!config.publicKey && !needsHomeScreen;

  const subscribe = async (time: string) => {
    const reg = await getRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(config!.publicKey!) });
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), reminderTime: time, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, learnerId: loadLearner()?.id ?? null }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save the reminder.");
  };

  const unsubscribe = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  };

  const toggle = async (on: boolean) => {
    if (!on) {
      setBusy(true);
      try {
        if (canSubscribe) await unsubscribe();
        setPrefs({ reminderEnabled: false });
        toast.success("Reminders turned off");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!canSubscribe) {
      // Remember the wish; it'll work once the requirements below are met.
      setPrefs({ reminderEnabled: true });
      return;
    }
    setBusy(true);
    try {
      // Ask for permission only now, in response to the tap.
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== "granted") {
        toast.message("Notifications are blocked, so reminders can't be shown. You can allow them in your browser or phone settings.");
        return;
      }
      await subscribe(prefs.reminderTime);
      setPrefs({ reminderEnabled: true });
      toast.success(`Reminder set for ${prefs.reminderTime} every day`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't turn on reminders.");
    } finally {
      setBusy(false);
    }
  };

  const changeTime = async (time: string) => {
    setPrefs({ reminderTime: time });
    if (prefs.reminderEnabled && canSubscribe && perm === "granted") {
      try {
        await subscribe(time);
      } catch {
        /* the toggle shows errors; time is saved locally either way */
      }
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) throw new Error("Turn reminders on first.");
      const res = await fetch("/api/push/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Test failed.");
      toast.success("Test sent — it should arrive in a few seconds.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="reminders" className="scroll-mt-24">
      <CardHeader icon={<BellRing className="h-5 w-5" />} title="Daily practice reminder" description="A gentle notification at your practice time." />
      <CardBody className="space-y-4">
        <Switch checked={prefs.reminderEnabled} onChange={(v) => void toggle(v)} label="Remind me to practise every day" description={busy ? "Working…" : undefined} id="reminder-toggle" />
        <Field label="Reminder time" htmlFor="reminder-time" hint="Uses this device's time zone.">
          <Input id="reminder-time" type="time" value={prefs.reminderTime} onChange={(e) => e.target.value && void changeTime(e.target.value)} className="w-40" />
        </Field>

        {needsHomeScreen && (
          <Callout tone="info" icon={<Smartphone className="h-4 w-4" />} title="On iPhone: add the app to your Home Screen first">
            <ol className="mt-1 list-inside list-decimal space-y-0.5">
              <li>
                Tap the <Share className="inline h-3.5 w-3.5" aria-label="Share" /> Share button in Safari.
              </li>
              <li>Choose “Add to Home Screen”, then open the app from the new icon.</li>
              <li>Come back here and turn reminders on (needs iOS 16.4 or newer).</li>
            </ol>
          </Callout>
        )}
        {!env.supported && !needsHomeScreen && (
          <Callout tone="warn" title="This browser can't show reminders">Try Chrome on Android or desktop, or the Home Screen app on iPhone.</Callout>
        )}
        {config && !config.enabled && (
          <Callout tone="neutral" title="Reminders will work after deployment">
            Notifications are sent by the website&apos;s server, so they start working once the site is online with its reminder keys set — see “Reminders” in the README. Your chosen time is saved.
          </Callout>
        )}
        {perm === "denied" && (
          <Callout tone="warn" title="Notifications are blocked">Allow notifications for this site in your browser or phone settings, then turn the reminder on again.</Callout>
        )}

        {prefs.reminderEnabled && canSubscribe && perm === "granted" && (
          <Button variant="secondary" size="sm" onClick={() => void sendTest()} disabled={busy}>
            Send a test notification
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
