"use client";

import { useData } from "@/hooks/use-data";
import { profileRepo, progressRepo } from "@/lib/storage/repositories";
import type { LessonProgress, Profile } from "@/lib/storage/schemas";

/** Lesson progress + profile (placement), reloaded whenever either changes. */
export function useLearningData() {
  const progress = useData<Record<string, LessonProgress>>(() => progressRepo.all(), ["lessonProgress"], {});
  const profile = useData<Profile | undefined>(() => profileRepo.get(), ["profile"], undefined);
  return {
    progress: progress.data,
    profile: profile.data,
    placement: profile.data?.placement,
    loading: progress.loading || profile.loading,
    error: progress.error ?? profile.error,
  };
}
