/**
 * Recordings live in their OWN IndexedDB database, separate from progress storage, and are never
 * synced or uploaded. Blobs and metadata are stored in two object stores.
 */
export interface RecordingMeta {
  id: string;
  title: string;
  /** Song sheet / custom song id this was recorded with. */
  sheetId?: string;
  songTitle?: string;
  createdAt: string;
  durationSec: number;
  mimeType: string;
  size: number;
}

export class RecordingStorageError extends Error {
  constructor(message: string, readonly quota = false) {
    super(message);
    this.name = "RecordingStorageError";
  }
}

const DB_NAME = "melody-masters-recordings";
const META = "meta";
const BLOBS = "blobs";
let dbp: Promise<IDBDatabase> | null = null;
const listeners = new Set<() => void>();

export function recordingsAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

function open(): Promise<IDBDatabase> {
  if (!recordingsAvailable()) return Promise.reject(new RecordingStorageError("This browser can't store recordings (private mode or storage blocked)."));
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" }).createIndex("bySheet", "sheetId");
        if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new RecordingStorageError("Couldn't open recording storage."));
      req.onblocked = () => reject(new RecordingStorageError("Recording storage is blocked by another tab."));
    });
    dbp.catch(() => (dbp = null));
  }
  return dbp;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("aborted"));
  });
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function isQuotaError(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

const emit = () => listeners.forEach((l) => l());

export const recordingsRepo = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  async list(sheetId?: string): Promise<RecordingMeta[]> {
    const db = await open();
    const store = db.transaction(META).objectStore(META);
    const rows = (await req(sheetId ? store.index("bySheet").getAll(sheetId) : store.getAll())) as RecordingMeta[];
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getBlob(id: string): Promise<Blob | undefined> {
    const db = await open();
    const row = (await req(db.transaction(BLOBS).objectStore(BLOBS).get(id))) as { type: string; data: ArrayBuffer } | undefined;
    return row ? new Blob([row.data], { type: row.type }) : undefined;
  },
  async save(meta: RecordingMeta, blob: Blob): Promise<void> {
    // Raw bytes + type (not a Blob): older iOS Safari couldn't store Blobs in IndexedDB reliably.
    const data = await blob.arrayBuffer();
    const db = await open();
    try {
      const tx = db.transaction([META, BLOBS], "readwrite");
      tx.objectStore(BLOBS).put({ type: blob.type || meta.mimeType, data }, meta.id);
      tx.objectStore(META).put(meta);
      await done(tx);
    } catch (e) {
      throw isQuotaError(e)
        ? new RecordingStorageError("Your phone is out of space for recordings. Delete some old ones and try again.", true)
        : new RecordingStorageError("Couldn't save the recording.");
    }
    emit();
  },
  async rename(id: string, title: string): Promise<void> {
    const db = await open();
    const tx = db.transaction(META, "readwrite");
    const store = tx.objectStore(META);
    const cur = (await req(store.get(id))) as RecordingMeta | undefined;
    if (cur) store.put({ ...cur, title: title.trim().slice(0, 100) || cur.title });
    await done(tx);
    emit();
  },
  async remove(id: string): Promise<void> {
    const db = await open();
    const tx = db.transaction([META, BLOBS], "readwrite");
    tx.objectStore(META).delete(id);
    tx.objectStore(BLOBS).delete(id);
    await done(tx);
    emit();
  },
  async clear(): Promise<void> {
    const db = await open();
    const tx = db.transaction([META, BLOBS], "readwrite");
    tx.objectStore(META).clear();
    tx.objectStore(BLOBS).clear();
    await done(tx);
    emit();
  },
  async usage(): Promise<{ count: number; bytes: number }> {
    const all = await this.list();
    return { count: all.length, bytes: all.reduce((a, r) => a + r.size, 0) };
  },
};

/** Test helper: forget the cached connection (fake-indexeddb is reset between tests). */
export function __resetRecordingsDb() {
  dbp = null;
}
