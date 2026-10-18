"use client";

import { useEffect, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { usePrefs } from "@/hooks/use-prefs";
import { onStorageError } from "@/lib/storage/db";
import { setMasterVolume } from "@/lib/audio/engine";
import { startSync } from "@/lib/learner/sync";

/** Applies theme + volume prefs and wires global toasts. */
export function Providers({ children }: { children: ReactNode }) {
  const [prefs] = usePrefs();

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", prefs.theme === "dark" || (prefs.theme === "system" && mq.matches));
    apply();
    root.dataset.instrument = prefs.instrument;
    if (prefs.theme !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [prefs.theme, prefs.instrument]);

  useEffect(() => setMasterVolume(prefs.volume), [prefs.volume]);

  useEffect(() => {
    let shown = false;
    onStorageError(() => {
      if (shown) return;
      shown = true;
      toast.warning("Browser storage isn't available, so progress is only kept until you close this tab.", { duration: 8000 });
    });
  }, []);

  // Cloud sync of the learner's progress (no-op until Supabase is configured and a name is chosen).
  useEffect(() => startSync(), []);

  useEffect(() => {
    // Offline app shell (production only, so development hot-reload isn't cached).
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <>
      {children}
      <Toaster position="bottom-right" mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }} richColors closeButton theme={prefs.theme === "system" ? "system" : prefs.theme} toastOptions={{ className: "!rounded-xl" }} />
    </>
  );
}
