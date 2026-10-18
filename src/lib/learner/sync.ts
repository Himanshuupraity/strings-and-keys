"use client";

import { ALL_COLLECTIONS, getAdapter, subscribe } from "@/lib/storage/db";
import { loadPrefs, savePrefs, subscribePrefs } from "@/lib/storage/prefs";
import { applyImport, exportAll, profileRepo, resetAllData } from "@/lib/storage/repositories";
import type { ExportBundle } from "@/lib/storage/schemas";
import { selectionAction, startupAction } from "./decide";
import { getSyncStatus, loadLearner, patchLearner, setLearner, setSyncStatus, type ActiveLearner } from "./store";

/**
 * Keeps this device's local progress in sync with the learner's row in Supabase (via /api/learners).
 * Local storage stays the source of truth while you practise; changes upload a couple of seconds
 * later, and the newest server copy is pulled when the app opens.
 */

export interface LearnerSummary {
  id: string;
  name: string;
  updatedAt: string;
}

const PUSH_DELAY_MS = 2000;
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing: Promise<void> | null = null;
let remoteEnabled: boolean | null = null;

/* ---------------- API ---------------- */

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: body as T };
}

export async function fetchLearners(): Promise<{ enabled: boolean; learners: LearnerSummary[]; error?: string }> {
  try {
    const r = await api<{ enabled: boolean; learners?: LearnerSummary[]; error?: string }>("/api/learners");
    remoteEnabled = !!r.body?.enabled;
    return { enabled: remoteEnabled, learners: r.body?.learners ?? [], error: r.status >= 400 ? r.body?.error ?? "Could not load names." : undefined };
  } catch {
    return { enabled: remoteEnabled ?? false, learners: [], error: "You're offline — saved names can't be loaded right now." };
  }
}

export async function isRemoteEnabled(): Promise<boolean> {
  if (remoteEnabled === null) await fetchLearners();
  return !!remoteEnabled;
}

async function fetchLearner(id: string) {
  return api<{ learner?: LearnerSummary; data?: ExportBundle | null; error?: string }>(`/api/learners/${id}`);
}

/* ---------------- Local data helpers ---------------- */

async function localHasData(): Promise<boolean> {
  for (const c of ALL_COLLECTIONS) if ((await getAdapter().list(c)).length) return true;
  return false;
}

async function setProfileName(name: string) {
  const p = await profileRepo.get();
  await profileRepo.save({ ...(p ?? {}), name });
}

/** Apply a server bundle without marking the result as a local change. */
async function applyRemote(bundle: ExportBundle, mode: "replace" | "merge") {
  applyingRemote = true;
  try {
    if (mode === "replace") {
      const theme = loadPrefs().theme; // theme is a per-device choice
      await resetAllData();
      await applyImport(bundle, "keep-imported", false);
      if (bundle.prefs && typeof bundle.prefs === "object") savePrefs({ ...(bundle.prefs as object), theme });
    } else {
      await applyImport(bundle, "keep-local", false);
    }
  } finally {
    applyingRemote = false;
  }
}

async function clearLocal() {
  applyingRemote = true;
  try {
    await resetAllData();
    savePrefs({ onboarded: false });
  } finally {
    applyingRemote = false;
  }
}

/* ---------------- Push ---------------- */

export function schedulePush(delay = PUSH_DELAY_MS) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushNow(), delay);
}

export async function pushNow(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (pushing) await pushing;
  const l = loadLearner();
  if (!l?.id) return;
  pushing = (async () => {
    setSyncStatus({ state: "saving", message: undefined });
    try {
      const bundle = await exportAll();
      let r = await api<{ updatedAt?: string; conflict?: boolean; error?: string }>(`/api/learners/${l.id}`, {
        method: "PUT",
        body: JSON.stringify({ bundle, baseUpdatedAt: l.syncedAt }),
      });
      if (r.status === 409) {
        // Another device saved first: merge its copy in (keeping this device's versions), then upload.
        const remote = await fetchLearner(l.id!);
        if (remote.body?.data) await applyRemote(remote.body.data, "merge");
        r = await api(`/api/learners/${l.id}`, { method: "PUT", body: JSON.stringify({ bundle: await exportAll(), force: true }) });
      }
      if (r.status === 404) {
        setSyncStatus({ state: "error", message: "This profile no longer exists on the server." });
        return;
      }
      if (r.status >= 400 || !r.body?.updatedAt) throw new Error(r.body?.error ?? `HTTP ${r.status}`);
      patchLearner({ syncedAt: r.body.updatedAt, dirty: false });
      setSyncStatus({ state: "idle", lastSyncedAt: r.body.updatedAt, message: undefined });
    } catch (e) {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setSyncStatus({ state: offline ? "offline" : "error", message: offline ? "Offline — your progress will upload when you're back online." : e instanceof Error ? e.message : "Sync failed." });
    }
  })();
  try {
    await pushing;
  } finally {
    pushing = null;
  }
}

/* ---------------- Choosing a learner ---------------- */

/** Continue as an existing learner (e.g. on a new device). */
export async function selectLearner(target: LearnerSummary): Promise<void> {
  const current = loadLearner();
  if (current?.id && current.id !== target.id && current.dirty) await pushNow();
  const r = await fetchLearner(target.id);
  if (r.status >= 400 || !r.body?.learner) throw new Error(r.body?.error ?? "Could not load that profile.");
  const data = r.body.data ?? null;
  const action = selectionAction({ sameLearner: current?.id === target.id, hadLearnerBefore: !!current, remoteHasData: !!data });
  if (action === "replace-local" && data) await applyRemote(data, "replace");
  if (action === "clear-local") await clearLocal();
  setLearner({ id: target.id, name: target.name, syncedAt: data ? r.body.learner.updatedAt : null, dirty: !data });
  applyingRemote = true;
  try {
    await setProfileName(target.name);
  } finally {
    applyingRemote = false;
  }
  setSyncStatus({ state: "idle", lastSyncedAt: data ? r.body.learner.updatedAt : null });
  if (!data) await pushNow();
}

export type CreateResult = { kind: "created" } | { kind: "exists"; learner: LearnerSummary } | { kind: "local" };

/**
 * Start as a new learner. If a learner with that name already exists on the server, nothing is
 * changed and the caller asks "Is this you?" before calling selectLearner().
 */
export async function createLearner(name: string): Promise<CreateResult> {
  const current = loadLearner();
  if (!(await isRemoteEnabled())) return createLocal(name);
  const r = await api<{ learner?: LearnerSummary; existed?: boolean; enabled?: boolean; error?: string }>("/api/learners", { method: "POST", body: JSON.stringify({ name }) });
  if (r.status === 503 && r.body?.enabled === false) {
    remoteEnabled = false;
    return createLocal(name);
  }
  if (r.status >= 400 || !r.body?.learner) throw new Error(r.body?.error ?? "Could not save your name.");
  if (r.body.existed) return { kind: "exists", learner: r.body.learner };
  if (current?.id && current.dirty) await pushNow();
  // First-time visitors keep anything they did before naming themselves; switching people starts fresh.
  if (current) await clearLocal();
  setLearner({ id: r.body.learner.id, name: r.body.learner.name, syncedAt: null, dirty: true });
  await setProfileName(r.body.learner.name);
  await pushNow();
  return { kind: "created" };
}

async function createLocal(name: string): Promise<CreateResult> {
  // Local-only: one learner per device, so a new name is just a rename — never wipe progress.
  setLearner({ id: null, name, syncedAt: null, dirty: false });
  await setProfileName(name);
  setSyncStatus({ state: "local-only" });
  return { kind: "local" };
}

/** "Switch learner": upload pending changes, then clear this device so the next person starts clean. */
export async function switchLearner(): Promise<{ ok: boolean; message?: string }> {
  const l = loadLearner();
  if (l?.id && l.dirty) {
    await pushNow();
    if (loadLearner()?.dirty) return { ok: false, message: "Couldn't upload your latest progress (offline?). Try again when connected." };
  }
  if (l?.id) await clearLocal();
  setLearner(null);
  return { ok: true };
}

/* ---------------- Startup + change tracking ---------------- */

/** On app open: pull the newest server copy or upload local changes. */
export async function reconcile(): Promise<void> {
  const l = loadLearner();
  if (!l) return;
  if (!(await isRemoteEnabled())) {
    setSyncStatus({ state: "local-only" });
    return;
  }
  // Learner named while Supabase wasn't configured: create their server profile now.
  if (!l.id) {
    try {
      const r = await api<{ learner?: LearnerSummary; existed?: boolean }>("/api/learners", { method: "POST", body: JSON.stringify({ name: l.name }) });
      if (!r.body?.learner) return;
      setLearner({ ...l, id: r.body.learner.id, syncedAt: null, dirty: true });
    } catch {
      setSyncStatus({ state: "offline" });
      return;
    }
  }
  const cur = loadLearner() as ActiveLearner;
  try {
    const r = await fetchLearner(cur.id!);
    if (r.status === 404) {
      setSyncStatus({ state: "error", message: "This profile was removed from the server." });
      return;
    }
    if (r.status >= 400 || !r.body?.learner) throw new Error();
    const action = startupAction({
      remoteHasData: !!r.body.data,
      remoteUpdatedAt: r.body.learner.updatedAt,
      syncedAt: cur.syncedAt,
      dirty: cur.dirty,
      localHasData: await localHasData(),
    });
    if (action === "replace-local") {
      await applyRemote(r.body.data!, "replace");
      patchLearner({ syncedAt: r.body.learner.updatedAt, dirty: false });
      setSyncStatus({ state: "idle", lastSyncedAt: r.body.learner.updatedAt });
    } else if (action === "merge-then-push") {
      await applyRemote(r.body.data!, "merge");
      patchLearner({ syncedAt: r.body.learner.updatedAt, dirty: true });
      await pushNow();
    } else if (action === "push") {
      await pushNow();
    } else {
      setSyncStatus({ state: "idle", lastSyncedAt: cur.syncedAt });
    }
  } catch {
    setSyncStatus({ state: navigator.onLine === false ? "offline" : "error", message: "Couldn't reach the server — progress is saved on this device and will sync later." });
  }
}

/** Wire up change tracking. Returns a cleanup function. */
export function startSync(): () => void {
  const onChange = () => {
    if (applyingRemote) return;
    const l = loadLearner();
    if (!l?.id) return;
    if (!l.dirty) patchLearner({ dirty: true });
    schedulePush();
  };
  const unsubData = subscribe(onChange);
  const unsubPrefs = subscribePrefs(onChange);
  const onOnline = () => loadLearner()?.dirty && void pushNow();
  const onHide = () => document.visibilityState === "hidden" && loadLearner()?.dirty && void pushNow();
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onHide);
  void reconcile();
  return () => {
    unsubData();
    unsubPrefs();
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onHide);
  };
}

export { getSyncStatus };

/** Test helper: forget the cached "is Supabase configured?" answer. */
export function __resetSyncCache() {
  remoteEnabled = null;
}
