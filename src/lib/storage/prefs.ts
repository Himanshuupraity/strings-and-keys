import { DEFAULT_PREFS, PrefsSchema, type Prefs } from "./schemas";

/**
 * Preferences are small and read synchronously on first render, so they live in localStorage
 * (with an in-memory fallback when storage is blocked). Exposed as an external store for
 * React's useSyncExternalStore.
 */
const KEY = "mm:prefs";
let cache: Prefs | null = null;
const listeners = new Set<() => void>();

export function loadPrefs(): Prefs {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? PrefsSchema.parse(JSON.parse(raw)) : DEFAULT_PREFS;
  } catch {
    cache = DEFAULT_PREFS;
  }
  return cache;
}

export function savePrefs(patch: Partial<Prefs>): Prefs {
  const next = PrefsSchema.parse({ ...loadPrefs(), ...patch });
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked or full: keep in memory for this session */
  }
  listeners.forEach((l) => l());
  return next;
}

export function subscribePrefs(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function getServerPrefs(): Prefs {
  return DEFAULT_PREFS;
}

/** Test helper. */
export function __resetPrefsCache() {
  cache = null;
}
