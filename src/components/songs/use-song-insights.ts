"use client";

import { useMemo } from "react";
import { useData } from "@/hooks/use-data";
import { drillRepo, progressRepo, songRepo } from "@/lib/storage/repositories";
import { BUILT_IN_SONGS } from "@/content/songs";
import { LESSONS } from "@/content/curriculum";
import { knownChords, type Instrument } from "@/lib/songs/known-chords";
import { recommendSongs } from "@/lib/songs/recommend";
import { songStatus } from "@/lib/songs/status";
import type { ChordDrillResult, LessonProgress, SongProgress } from "@/lib/storage/schemas";

interface Evidence {
  songProgress: SongProgress[];
  drills: ChordDrillResult[];
  lessonProgress: Record<string, LessonProgress>;
}

/** Known chords, song statuses and "learn next" suggestions for one instrument. */
export function useSongInsights(instrument: Instrument, limit = 3) {
  const { data, loading } = useData<Evidence>(
    async () => {
      const [songProgress, drills, lessonProgress] = await Promise.all([songRepo.list(), drillRepo.list(), progressRepo.all()]);
      return { songProgress, drills, lessonProgress };
    },
    ["songProgress", "chordDrills", "lessonProgress"],
    { songProgress: [], drills: [], lessonProgress: {} },
  );
  return useMemo(() => {
    const known = knownChords({ instrument, songs: BUILT_IN_SONGS, lessons: LESSONS, ...data });
    const suggestions = recommendSongs({ songs: BUILT_IN_SONGS, known: new Set(known.keys()), songProgress: data.songProgress, instrument, limit });
    const statusFor = (songId: string) => {
      const song = BUILT_IN_SONGS.find((s) => s.id === songId);
      const progress = data.songProgress.find((p) => p.songId === songId && p.instrument === instrument);
      return song ? songStatus(song, progress) : null;
    };
    return { loading, known, suggestions, statusFor };
  }, [data, instrument, limit, loading]);
}
