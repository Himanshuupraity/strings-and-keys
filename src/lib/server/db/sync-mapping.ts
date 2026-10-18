import { z } from "zod";
import type { CollectionName } from "@/lib/storage/adapter";
import {
  ChordDrillSchema,
  CoachMessageSchema,
  ExerciseResultSchema,
  ExportSchema,
  GoalsSchema,
  LessonProgressSchema,
  PracticeSessionSchema,
  ProfileSchema,
  QuizAttemptSchema,
  SongProgressSchema,
  TranspositionSchema,
  VideoStateSchema,
  type ExportBundle,
} from "@/lib/storage/schemas";

/**
 * Pure helpers for the sync API: validating uploaded bundles and comparing them with the server
 * copy. No database access here, so it is unit-testable.
 */

/** Upload limit for one bundle (the whole JSON body). */
export const MAX_BUNDLE_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS_PER_COLLECTION = 5000;

export const SYNC_COLLECTIONS = [
  "profile",
  "goals",
  "lessonProgress",
  "quizAttempts",
  "exerciseResults",
  "practiceSessions",
  "chordDrills",
  "savedSongs",
  "songProgress",
  "videoState",
  "transpositions",
  "coachHistory",
] as const satisfies readonly CollectionName[];
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

const JsonObject = z.record(z.string(), z.unknown());

/** Row validators. Keys must match how the device stores them (see repositories.ts). */
const ROW_SCHEMAS: Record<SyncCollection, z.ZodTypeAny> = {
  profile: ProfileSchema,
  goals: GoalsSchema,
  lessonProgress: LessonProgressSchema,
  quizAttempts: QuizAttemptSchema,
  exerciseResults: ExerciseResultSchema,
  practiceSessions: PracticeSessionSchema,
  chordDrills: ChordDrillSchema,
  savedSongs: JsonObject,
  songProgress: SongProgressSchema,
  videoState: VideoStateSchema,
  transpositions: TranspositionSchema,
  coachHistory: CoachMessageSchema,
};

/** Expected key for a row, so a bundle can't store a row under a misleading key. */
function expectedKey(c: SyncCollection, v: Record<string, unknown>): string | null {
  switch (c) {
    case "profile":
    case "goals":
      return "me";
    case "lessonProgress":
      return String(v.lessonId);
    case "songProgress":
      return `${v.songId}:${v.instrument}`;
    case "videoState":
      return String(v.videoId);
    case "savedSongs":
      return null; // any key
    default:
      return String(v.id);
  }
}

export interface Row {
  key: string;
  value: unknown;
}
export type CleanBundle = Record<SyncCollection, Row[]>;

export interface ValidationResult {
  bundle: CleanBundle;
  prefs: Record<string, unknown> | null;
  rejected: { collection: string; key: string; reason: string }[];
}

export function emptyBundle(): CleanBundle {
  return Object.fromEntries(SYNC_COLLECTIONS.map((c) => [c, []])) as unknown as CleanBundle;
}

const KeySchema = z.string().min(1).max(200);

/** Validate an uploaded bundle. Throws on a malformed envelope; drops (and reports) bad rows. */
export function validateBundle(input: unknown): ValidationResult {
  const env = ExportSchema.parse(input);
  const bundle = emptyBundle();
  const rejected: ValidationResult["rejected"] = [];
  for (const [c, rows] of Object.entries(env.collections)) {
    if (!(SYNC_COLLECTIONS as readonly string[]).includes(c)) {
      if (rows.length) rejected.push({ collection: c, key: "*", reason: "unknown collection" });
      continue;
    }
    const col = c as SyncCollection;
    if (rows.length > MAX_ROWS_PER_COLLECTION) throw new Error(`Too many rows in ${c} (max ${MAX_ROWS_PER_COLLECTION}).`);
    for (const r of rows) {
      if (!KeySchema.safeParse(r.key).success) {
        rejected.push({ collection: c, key: String(r.key).slice(0, 40), reason: "invalid key" });
        continue;
      }
      const parsed = ROW_SCHEMAS[col].safeParse(r.value);
      if (!parsed.success) {
        rejected.push({ collection: c, key: r.key, reason: "invalid value" });
        continue;
      }
      const exp = expectedKey(col, parsed.data as Record<string, unknown>);
      if (exp !== null && exp !== r.key) {
        rejected.push({ collection: c, key: r.key, reason: `key should be "${exp}"` });
        continue;
      }
      bundle[col].push({ key: r.key, value: parsed.data });
    }
  }
  const prefs = env.prefs && typeof env.prefs === "object" && !Array.isArray(env.prefs) ? (env.prefs as Record<string, unknown>) : null;
  return { bundle, prefs, rejected };
}

/** JSON with sorted keys and undefined dropped — used to detect identical rows. */
export function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.fromEntries(
        Object.keys(val)
          .sort()
          .filter((k) => (val as Record<string, unknown>)[k] !== undefined)
          .map((k) => [k, (val as Record<string, unknown>)[k]]),
      );
    }
    return val;
  });
}

export interface SyncPlan {
  added: number;
  identical: number;
  conflicts: { collection: string; key: string }[];
}

/** Compare an upload with what the server holds. */
export function planSync(server: CleanBundle, upload: CleanBundle): SyncPlan {
  const plan: SyncPlan = { added: 0, identical: 0, conflicts: [] };
  for (const c of SYNC_COLLECTIONS) {
    const existing = new Map(server[c].map((r) => [r.key, canonical(r.value)]));
    for (const r of upload[c]) {
      const e = existing.get(r.key);
      if (e === undefined) plan.added++;
      else if (e === canonical(r.value)) plan.identical++;
      else plan.conflicts.push({ collection: c, key: r.key });
    }
  }
  return plan;
}

export const StrategySchema = z.enum(["keep-server", "keep-uploaded"]);
export type SyncStrategy = z.infer<typeof StrategySchema>;

export const SyncPostSchema = z.object({
  bundle: z.unknown(),
  strategy: StrategySchema.optional(),
  dryRun: z.boolean().optional(),
});

/** Rows to actually write for a given strategy. Identical rows are skipped. */
export function rowsToWrite(server: CleanBundle, upload: CleanBundle, strategy: SyncStrategy): CleanBundle {
  const out = emptyBundle();
  for (const c of SYNC_COLLECTIONS) {
    const existing = new Map(server[c].map((r) => [r.key, canonical(r.value)]));
    for (const r of upload[c]) {
      const e = existing.get(r.key);
      if (e === undefined) out[c].push(r);
      else if (e !== canonical(r.value) && strategy === "keep-uploaded") out[c].push(r);
    }
  }
  return out;
}

export function toExportBundle(b: CleanBundle, prefs: unknown, version: number): ExportBundle {
  return { app: "melody-masters", version, exportedAt: new Date().toISOString(), prefs: prefs ?? {}, collections: b };
}

/* ---- enum conversions between device format and DB enums ---- */
export const statusToDb = (s: string) => s.replace("-", "_") as "not_started" | "in_progress" | "completed" | "mastered";
export const statusFromDb = (s: string) => s.replace("_", "-");
