import { ensureMigrated, getAdapter, notify } from "@/lib/storage/db";
import { RevisionItemSchema, type RevisionItem } from "@/lib/storage/schemas";
import { isDue, isRetired, localDay } from "./schedule";

/** Revision items live in the synced "revision" collection (so they follow the learner across devices). */
export const revisionRepo = {
  async all(): Promise<RevisionItem[]> {
    await ensureMigrated();
    const rows = await getAdapter().list<unknown>("revision");
    return rows.flatMap((r) => {
      const p = RevisionItemSchema.safeParse(r.value);
      return p.success ? [p.data] : [];
    });
  },
  async map(): Promise<Record<string, RevisionItem>> {
    return Object.fromEntries((await this.all()).map((i) => [i.id, i]));
  },
  async saveMany(items: RevisionItem[]) {
    if (!items.length) return;
    await ensureMigrated();
    for (const it of items) {
      const row = RevisionItemSchema.parse(it);
      // Retired items leave the queue for good.
      if (isRetired(row)) await getAdapter().remove("revision", row.id);
      else await getAdapter().set("revision", row.id, row);
    }
    notify("revision");
  },
  async due(today = localDay()): Promise<RevisionItem[]> {
    return (await this.all()).filter((i) => isDue(i, today)).sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
  },
};
