import type { Course, Lesson, Level } from "../types";
import type { Track } from "@/lib/storage/schemas";
import { LEVEL_0 } from "./level-0";
import { LEVEL_1 } from "./level-1";
import { LEVEL_2 } from "./level-2";
import { LEVEL_3 } from "./level-3";
import { LEVEL_4 } from "./level-4";
import { LEVEL_5 } from "./level-5";
import { LEVEL_6 } from "./level-6";
import { LEVEL_7 } from "./level-7";
import { TAAL_LESSONS } from "./taal";

export const LESSONS: Lesson[] = [...LEVEL_0, ...LEVEL_1, ...LEVEL_2, ...LEVEL_3, ...LEVEL_4, ...LEVEL_5, ...LEVEL_6, ...LEVEL_7, ...TAAL_LESSONS].sort(
  (a, b) => a.level - b.level || a.order - b.order,
);

const BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export function getLesson(id: string): Lesson | undefined {
  return BY_ID.get(id);
}

export function lessonsForTrack(track: Track): Lesson[] {
  return LESSONS.filter((l) => l.track === track);
}

/** Lessons relevant to an instrument mode: that instrument's track + shared theory. */
export function lessonsForInstrument(instrument: "guitar" | "piano"): Lesson[] {
  return LESSONS.filter((l) => l.track === instrument || l.track === "theory");
}

export function lessonsByLevel(lessons: Lesson[]): Map<Level, Lesson[]> {
  const m = new Map<Level, Lesson[]>();
  for (const l of lessons) m.set(l.level, [...(m.get(l.level) ?? []), l]);
  return m;
}

export const COURSES: Record<Track, Course> = {
  theory: { track: "theory", title: "Music theory (shared)", description: "Notes, rhythm, reading music, scales and harmony — shared by guitar and piano.", levels: [0, 1, 5, 7] },
  guitar: { track: "guitar", title: "Guitar course", description: "From holding the guitar to chords, strumming, riffs, fingerstyle and lead.", levels: [0, 2, 3, 5, 6, 7] },
  piano: { track: "piano", title: "Piano & keyboard course", description: "From finding middle C to two-hand coordination, voicings and accompaniment.", levels: [0, 4, 5, 6, 7] },
};
