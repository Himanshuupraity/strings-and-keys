/**
 * Storage abstraction. UI never talks to localStorage / IndexedDB / a server directly —
 * it goes through repositories (see ./repositories.ts) which use a StorageAdapter.
 */
export type CollectionName =
  | "prefs"
  | "profile"
  | "lessonProgress"
  | "quizAttempts"
  | "practiceSessions"
  | "chordDrills"
  | "exerciseResults"
  | "savedSongs"
  | "songProgress"
  | "videoState"
  | "transpositions"
  | "coachHistory"
  | "goals"
  | "revision"
  | "notes"
  | "meta";

export interface StorageAdapter {
  readonly kind: "localStorage" | "indexedDB" | "memory" | "remote";
  get<T>(collection: CollectionName, key: string): Promise<T | undefined>;
  set<T>(collection: CollectionName, key: string, value: T): Promise<void>;
  update<T>(collection: CollectionName, key: string, updater: (prev: T | undefined) => T): Promise<T>;
  remove(collection: CollectionName, key: string): Promise<void>;
  list<T>(collection: CollectionName): Promise<{ key: string; value: T }[]>;
  clear(collection?: CollectionName): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string, readonly cause?: unknown, readonly quota = false) {
    super(message);
    this.name = "StorageError";
  }
}

export function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22)
  );
}

/* ---------------- Memory ---------------- */

export class MemoryAdapter implements StorageAdapter {
  readonly kind = "memory" as const;
  private data = new Map<string, Map<string, unknown>>();
  private col(c: string) {
    if (!this.data.has(c)) this.data.set(c, new Map());
    return this.data.get(c)!;
  }
  async get<T>(c: CollectionName, k: string) {
    const v = this.col(c).get(k);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }
  async set<T>(c: CollectionName, k: string, v: T) {
    this.col(c).set(k, structuredClone(v));
  }
  async update<T>(c: CollectionName, k: string, fn: (p: T | undefined) => T) {
    const next = fn(await this.get<T>(c, k));
    await this.set(c, k, next);
    return next;
  }
  async remove(c: CollectionName, k: string) {
    this.col(c).delete(k);
  }
  async list<T>(c: CollectionName) {
    return [...this.col(c).entries()].map(([key, value]) => ({ key, value: structuredClone(value) as T }));
  }
  async clear(c?: CollectionName) {
    if (c) this.data.delete(c);
    else this.data.clear();
  }
}

/* ---------------- localStorage ---------------- */

const LS_PREFIX = "mm:";

export function localStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const k = "__mm_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly kind = "localStorage" as const;
  private k(c: string, key: string) {
    return `${LS_PREFIX}${c}:${key}`;
  }
  async get<T>(c: CollectionName, key: string): Promise<T | undefined> {
    try {
      const raw = window.localStorage.getItem(this.k(c, key));
      if (raw == null) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      // Malformed JSON or blocked storage: behave as missing.
      return undefined;
    }
  }
  async set<T>(c: CollectionName, key: string, value: T) {
    try {
      window.localStorage.setItem(this.k(c, key), JSON.stringify(value));
    } catch (e) {
      throw new StorageError("Could not save to browser storage", e, isQuotaError(e));
    }
  }
  async update<T>(c: CollectionName, key: string, fn: (p: T | undefined) => T) {
    const next = fn(await this.get<T>(c, key));
    await this.set(c, key, next);
    return next;
  }
  async remove(c: CollectionName, key: string) {
    try {
      window.localStorage.removeItem(this.k(c, key));
    } catch {
      /* ignore */
    }
  }
  async list<T>(c: CollectionName) {
    const out: { key: string; value: T }[] = [];
    try {
      const prefix = `${LS_PREFIX}${c}:`;
      for (let i = 0; i < window.localStorage.length; i++) {
        const full = window.localStorage.key(i);
        if (!full?.startsWith(prefix)) continue;
        try {
          out.push({ key: full.slice(prefix.length), value: JSON.parse(window.localStorage.getItem(full)!) as T });
        } catch {
          /* skip malformed */
        }
      }
    } catch {
      /* storage unavailable */
    }
    return out;
  }
  async clear(c?: CollectionName) {
    try {
      const prefix = c ? `${LS_PREFIX}${c}:` : LS_PREFIX;
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith(prefix)) keys.push(k);
      }
      keys.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}

/* ---------------- IndexedDB ---------------- */

const DB_NAME = "melody-masters";
const DB_VERSION = 1;
const STORE = "records";

export function indexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** One object store keyed by [collection, key] with an index on collection. */
export class IndexedDBAdapter implements StorageAdapter {
  readonly kind = "indexedDB" as const;
  private dbp: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbp) {
      this.dbp = new Promise((resolve, reject) => {
        const open = indexedDB.open(DB_NAME, DB_VERSION);
        open.onupgradeneeded = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const s = db.createObjectStore(STORE, { keyPath: ["collection", "key"] });
            s.createIndex("byCollection", "collection");
          }
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
        open.onblocked = () => reject(new StorageError("IndexedDB blocked"));
      });
      this.dbp.catch(() => (this.dbp = null));
    }
    return this.dbp;
  }

  private async store(mode: IDBTransactionMode) {
    const db = await this.db();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  async get<T>(c: CollectionName, key: string) {
    const row = await req((await this.store("readonly")).get([c, key]));
    return (row as { value: T } | undefined)?.value;
  }
  async set<T>(c: CollectionName, key: string, value: T) {
    try {
      await req((await this.store("readwrite")).put({ collection: c, key, value }));
    } catch (e) {
      throw new StorageError("Could not save to IndexedDB", e, isQuotaError(e));
    }
  }
  async update<T>(c: CollectionName, key: string, fn: (p: T | undefined) => T) {
    const next = fn(await this.get<T>(c, key));
    await this.set(c, key, next);
    return next;
  }
  async remove(c: CollectionName, key: string) {
    await req((await this.store("readwrite")).delete([c, key]));
  }
  async list<T>(c: CollectionName) {
    const rows = (await req((await this.store("readonly")).index("byCollection").getAll(c))) as { key: string; value: T }[];
    return rows.map((r) => ({ key: r.key, value: r.value }));
  }
  async clear(c?: CollectionName) {
    const s = await this.store("readwrite");
    if (!c) {
      await req(s.clear());
      return;
    }
    const keys = (await req(s.index("byCollection").getAllKeys(c))) as IDBValidKey[];
    await Promise.all(keys.map((k) => req(s.delete(k))));
  }
}

/**
 * Wraps an adapter so that any failure falls back to an in-memory adapter instead of crashing.
 * `onError` lets the UI show a non-blocking toast.
 */
export class ResilientAdapter implements StorageAdapter {
  private fallback = new MemoryAdapter();
  private failed = false;
  constructor(private primary: StorageAdapter, private onError?: (e: unknown) => void) {}
  get kind() {
    return this.failed ? this.fallback.kind : this.primary.kind;
  }
  get degraded() {
    return this.failed;
  }
  private async run<R>(op: (a: StorageAdapter) => Promise<R>): Promise<R> {
    if (this.failed) return op(this.fallback);
    try {
      return await op(this.primary);
    } catch (e) {
      this.onError?.(e);
      if (e instanceof StorageError && e.quota) {
        // Quota: keep primary for reads, but this write goes to memory.
        return op(this.fallback);
      }
      this.failed = true;
      return op(this.fallback);
    }
  }
  get<T>(c: CollectionName, k: string) {
    return this.run((a) => a.get<T>(c, k));
  }
  set<T>(c: CollectionName, k: string, v: T) {
    return this.run((a) => a.set(c, k, v));
  }
  update<T>(c: CollectionName, k: string, fn: (p: T | undefined) => T) {
    return this.run((a) => a.update(c, k, fn));
  }
  remove(c: CollectionName, k: string) {
    return this.run((a) => a.remove(c, k));
  }
  list<T>(c: CollectionName) {
    return this.run((a) => a.list<T>(c));
  }
  clear(c?: CollectionName) {
    return this.run((a) => a.clear(c));
  }
}
