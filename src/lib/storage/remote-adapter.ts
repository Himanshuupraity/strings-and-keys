import { StorageError, type CollectionName, type StorageAdapter } from "./adapter";
import { ExportSchema, SCHEMA_VERSION, type ExportBundle } from "./schemas";

/**
 * StorageAdapter backed by the account sync API (/api/sync). Not active by default — local-first
 * storage is. It exists so a signed-in student could later run fully against their account via
 * `setAdapter(new RemoteAdapter())`, without UI changes.
 *
 * Reads come from a cached copy of the server bundle; writes upload single rows with an explicit
 * "keep-uploaded" strategy (the student's own action on this device is the newest version).
 * Deleting rows isn't supported by the sync API yet, so `remove`/`clear` throw a StorageError —
 * wrap this adapter in ResilientAdapter if used as a primary store.
 */
export class RemoteAdapter implements StorageAdapter {
  readonly kind = "remote" as const;
  private cache: Promise<ExportBundle> | null = null;

  constructor(private readonly endpoint = "/api/sync", private readonly fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  private load(): Promise<ExportBundle> {
    if (!this.cache) {
      this.cache = (async () => {
        const res = await this.fetchImpl(this.endpoint, { credentials: "same-origin", cache: "no-store" });
        if (!res.ok) throw new StorageError(`Account sync unavailable (${res.status})`);
        return ExportSchema.parse(await res.json());
      })();
      this.cache.catch(() => (this.cache = null));
    }
    return this.cache;
  }

  /** Forget the cached copy (e.g. after signing in on another device). */
  refresh() {
    this.cache = null;
  }

  async get<T>(c: CollectionName, key: string): Promise<T | undefined> {
    const b = await this.load();
    return b.collections[c]?.find((r) => r.key === key)?.value as T | undefined;
  }

  async list<T>(c: CollectionName): Promise<{ key: string; value: T }[]> {
    const b = await this.load();
    return (b.collections[c] ?? []).map((r) => ({ key: r.key, value: r.value as T }));
  }

  async set<T>(c: CollectionName, key: string, value: T): Promise<void> {
    const bundle: ExportBundle = { app: "melody-masters", version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), prefs: null, collections: { [c]: [{ key, value }] } };
    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundle, strategy: "keep-uploaded" }),
    });
    if (!res.ok) throw new StorageError(`Could not save to your account (${res.status})`);
    const b = await this.load().catch(() => null);
    if (b) {
      const rows = (b.collections[c] ??= []);
      const i = rows.findIndex((r) => r.key === key);
      if (i >= 0) rows[i] = { key, value };
      else rows.push({ key, value });
    }
  }

  async update<T>(c: CollectionName, key: string, updater: (prev: T | undefined) => T): Promise<T> {
    const next = updater(await this.get<T>(c, key));
    await this.set(c, key, next);
    return next;
  }

  async remove(): Promise<void> {
    throw new StorageError("Deleting items from your account isn't supported yet.");
  }

  async clear(): Promise<void> {
    throw new StorageError("Clearing your account data isn't supported yet.");
  }
}
