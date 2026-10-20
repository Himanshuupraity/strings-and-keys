import { ensureMigrated, getAdapter, notify, uid } from "@/lib/storage/db";
import { NoteSchema, type Note } from "./model";

/** The student's notes, in the `notes` collection (synced with the rest of their data). */
export const notesRepo = {
  async list(): Promise<Note[]> {
    await ensureMigrated();
    const rows = await getAdapter().list<unknown>("notes");
    return rows
      .map((r) => NoteSchema.safeParse(r.value))
      .flatMap((p) => (p.success ? [p.data] : []))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id: string): Promise<Note | undefined> {
    await ensureMigrated();
    const p = NoteSchema.safeParse(await getAdapter().get("notes", id));
    return p.success ? p.data : undefined;
  },
  async save(input: Omit<Note, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string }): Promise<Note> {
    const now = new Date().toISOString();
    const row = NoteSchema.parse({ ...input, id: input.id ?? uid("note_"), createdAt: input.createdAt ?? now, updatedAt: now });
    await ensureMigrated();
    await getAdapter().set("notes", row.id, row);
    notify("notes");
    return row;
  },
  async remove(id: string) {
    await getAdapter().remove("notes", id);
    notify("notes");
  },
};
