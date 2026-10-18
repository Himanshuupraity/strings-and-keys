import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { CustomSongPage } from "@/components/songs/custom-song-page";

export const metadata: Metadata = { title: "My song · Song Lab" };

export default function CustomSong() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <CustomSongPage />
    </Suspense>
  );
}
