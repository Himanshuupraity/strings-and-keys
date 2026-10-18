"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getServerPrefs, loadPrefs, savePrefs, subscribePrefs } from "@/lib/storage/prefs";
import type { Prefs } from "@/lib/storage/schemas";

/** Persisted user preferences (instrument mode, theme, labels, keyboard size…). */
export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const prefs = useSyncExternalStore(subscribePrefs, loadPrefs, getServerPrefs);
  const update = useCallback((patch: Partial<Prefs>) => {
    savePrefs(patch);
  }, []);
  return [prefs, update];
}

/** True after hydration — use to avoid showing server defaults as if they were saved data. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
