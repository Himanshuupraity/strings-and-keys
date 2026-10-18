import { z } from "zod";
import { ensureMigrated, getAdapter, notify, uid } from "@/lib/storage/db";
import { parseChord } from "@/lib/music/chords";
import type { Song } from "@/content/songs/types";

/**
 * User-provided songs (chords only), stored in the `savedSongs` collection through the storage
 * abstraction. These are the student's own data — we never upload or share them.
 */
const BarSchema = z.union([z.string(), z.array(z.tuple([z.string(), z.number().positive()]))]);

export const CustomSongSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(80),
  artist: z.string().max(80).catch(""),
  key: z.string().min(1).max(4),
  tempo: z.number().int().min(40).max(220),
  beatsPerBar: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(6)]),
  strum: z.string().max(16).catch("D-DU-UDU"),
  notes: z.string().max(500).catch(""),
  sections: z
    .array(z.object({ id: z.string(), name: z.string().min(1).max(40), bars: z.array(BarSchema).min(1).max(64) }))
    .min(1)
    .max(12),
  /** Catalogue id this was created from, if any. */
  fromCatalogue: z.string().optional(),
  /** Pasted lyrics + chords (song sheet). The student's own copy for personal practice. */
  sheet: z.string().max(30000).optional(),
  /** Optional YouTube link to play the song beside the sheet. */
  youtube: z.string().max(300).optional(),
  /** Optional link to the page the lyrics/chords came from (e.g. a chord website). */
  sourceUrl: z.string().max(500).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomSong = z.infer<typeof CustomSongSchema>;

/** Every chord must be a symbol we understand. Returns the invalid ones. */
export function invalidChords(song: Pick<CustomSong, "sections">): string[] {
  const bad = new Set<string>();
  for (const s of song.sections)
    for (const b of s.bars) for (const c of typeof b === "string" ? [b] : b.map(([x]) => x)) if (!parseChord(c)) bad.add(c);
  return [...bad];
}

export const customSongRepo = {
  async list(): Promise<CustomSong[]> {
    await ensureMigrated();
    const rows = await getAdapter().list<unknown>("savedSongs");
    return rows
      .map((r) => CustomSongSchema.safeParse(r.value))
      .flatMap((p) => (p.success ? [p.data] : []))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id: string): Promise<CustomSong | undefined> {
    await ensureMigrated();
    const p = CustomSongSchema.safeParse(await getAdapter().get("savedSongs", id));
    return p.success ? p.data : undefined;
  },
  async save(input: Omit<CustomSong, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string }): Promise<CustomSong> {
    const now = new Date().toISOString();
    const row = CustomSongSchema.parse({ ...input, id: input.id ?? uid("song_"), createdAt: input.createdAt ?? now, updatedAt: now });
    const bad = invalidChords(row);
    if (bad.length) throw new Error(`Unknown chord${bad.length > 1 ? "s" : ""}: ${bad.join(", ")}`);
    await ensureMigrated();
    await getAdapter().set("savedSongs", row.id, row);
    notify("savedSongs");
    return row;
  },
  async remove(id: string) {
    await getAdapter().remove("savedSongs", id);
    notify("savedSongs");
  },
};

/** Adapts a custom song to the shared Song model so it gets the same practice tools. */
export function customToSong(c: CustomSong): Song {
  return {
    id: c.id,
    title: c.title,
    artist: c.artist || "Unknown artist",
    source: "user",
    licence: "User-provided chords · saved on this device",
    genre: "user",
    difficulty: 2,
    key: c.key,
    scale: /m$/.test(c.key) ? "naturalMinor" : "major",
    tempo: c.tempo,
    beatsPerBar: c.beatsPerBar,
    intro: c.notes || "Your own chord chart. Use the tools below to loop sections, slow down and find an easier capo position.",
    sections: c.sections.map((s) => ({ id: s.id, name: s.name, bars: s.bars })),
    strum: { pattern: c.strum || "D-DU-UDU", description: "Your chosen strumming pattern." },
    pianoTip: "Try block chords first, then broken chords once the changes feel easy.",
    prerequisites: [],
    tags: ["user-provided"],
  };
}
