/**
 * The learner using this device: name, their Supabase id (null in local-only mode), and sync state.
 * Kept in localStorage so the name screen is skipped on later visits.
 */
export interface ActiveLearner {
  id: string | null;
  name: string;
  /** Server updated_at of the copy this device last synced with. */
  syncedAt: string | null;
  /** Local changes not yet uploaded. */
  dirty: boolean;
}

export type SyncState = "local-only" | "idle" | "saving" | "offline" | "error";
export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: string | null;
  message?: string;
}

const KEY = "mm:learner";
let cache: ActiveLearner | null | undefined;
let status: SyncStatus = { state: "local-only", lastSyncedAt: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function loadLearner(): ActiveLearner | null {
  if (cache !== undefined) return cache;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<ActiveLearner>) : null;
    cache = v && typeof v.name === "string" && v.name ? { id: v.id ?? null, name: v.name, syncedAt: v.syncedAt ?? null, dirty: !!v.dirty } : null;
  } catch {
    cache = null;
  }
  return cache;
}

export function setLearner(next: ActiveLearner | null) {
  cache = next;
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: keep in memory */
  }
  emit();
}

export function patchLearner(patch: Partial<ActiveLearner>) {
  const cur = loadLearner();
  if (cur) setLearner({ ...cur, ...patch });
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function setSyncStatus(s: Partial<SyncStatus>) {
  status = { ...status, ...s };
  emit();
}

export function subscribeLearner(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Test helper. */
export function __resetLearnerCache() {
  cache = undefined;
  status = { state: "local-only", lastSyncedAt: null };
}
