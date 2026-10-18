import type { Song } from "@/content/songs/types";
import type { SongProgress } from "@/lib/storage/schemas";

export type SongState = "new" | "learning" | "can-play" | "mastered";

export interface SongStatus {
  state: SongState;
  /** Mastered sections / all sections (0..1). */
  pct: number;
  mastered: number;
  total: number;
}

/**
 * Song status from the student's own "I can play this" marks:
 *  - mastered: every section marked
 *  - can play: at least half the sections marked
 *  - learning: anything practised or marked
 */
export function songStatus(song: Pick<Song, "sections">, progress?: Pick<SongProgress, "sectionsMastered" | "sectionsPracticed" | "minutes">): SongStatus {
  const total = song.sections.length || 1;
  const ids = new Set(song.sections.map((s) => s.id));
  const mastered = (progress?.sectionsMastered ?? []).filter((id) => ids.has(id)).length;
  const pct = mastered / total;
  let state: SongState = "new";
  if (pct >= 1) state = "mastered";
  else if (pct >= 0.5) state = "can-play";
  else if (mastered > 0 || (progress?.sectionsPracticed.length ?? 0) > 0 || (progress?.minutes ?? 0) > 0) state = "learning";
  return { state, pct, mastered, total };
}

export const STATE_LABEL: Record<SongState, string> = { new: "New", learning: "Learning", "can-play": "Can play", mastered: "Mastered" };
