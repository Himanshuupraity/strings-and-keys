import {
  IndexedDBAdapter,
  LocalStorageAdapter,
  MemoryAdapter,
  ResilientAdapter,
  indexedDBAvailable,
  localStorageAvailable,
  type CollectionName,
  type StorageAdapter,
} from "./adapter";
import { SCHEMA_VERSION } from "./schemas";

/**
 * Picks the storage adapter. Priority (zero-config): IndexedDB → localStorage → memory.
 * A remote adapter can be injected with `setAdapter` after the user signs in and chooses to sync.
 */
type Listener = (collection: CollectionName) => void;

let adapter: StorageAdapter | null = null;
const listeners = new Set<Listener>();
let errorHandler: ((e: unknown) => void) | undefined;
let migrated: Promise<void> | null = null;

export function onStorageError(fn: (e: unknown) => void) {
  errorHandler = fn;
}

export function createDefaultAdapter(): StorageAdapter {
  if (typeof window === "undefined") return new MemoryAdapter();
  const primary = indexedDBAvailable() ? new IndexedDBAdapter() : localStorageAvailable() ? new LocalStorageAdapter() : new MemoryAdapter();
  return new ResilientAdapter(primary, (e) => errorHandler?.(e));
}

export function getAdapter(): StorageAdapter {
  if (!adapter) adapter = createDefaultAdapter();
  return adapter;
}

/** Swap the backing store (tests, or remote sync). UI code doesn't change. */
export function setAdapter(a: StorageAdapter) {
  adapter = a;
  migrated = null;
  listeners.forEach((l) => ALL_COLLECTIONS.forEach((c) => l(c)));
}

export const ALL_COLLECTIONS: CollectionName[] = [
  "profile", "lessonProgress", "quizAttempts", "practiceSessions", "chordDrills", "exerciseResults",
  "savedSongs", "songProgress", "videoState", "transpositions", "coachHistory", "goals",
];

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(collection: CollectionName) {
  listeners.forEach((l) => l(collection));
}

/** Data migrations, keyed by the version they upgrade TO. */
const MIGRATIONS: Record<number, (a: StorageAdapter) => Promise<void>> = {
  // 2: async (a) => { ... }  — add future migrations here.
};

export async function ensureMigrated(): Promise<void> {
  if (!migrated) {
    migrated = (async () => {
      const a = getAdapter();
      try {
        const current = (await a.get<number>("meta", "schemaVersion")) ?? 0;
        for (let v = current + 1; v <= SCHEMA_VERSION; v++) await MIGRATIONS[v]?.(a);
        if (current !== SCHEMA_VERSION) await a.set("meta", "schemaVersion", SCHEMA_VERSION);
      } catch (e) {
        errorHandler?.(e);
      }
    })();
  }
  return migrated;
}

export function uid(prefix = ""): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + r;
}
