import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { SheetPage } from "@/components/songs/sheet/sheet-page";

export const metadata: Metadata = { title: "Song sheet" };

export default function SongSheetRoute() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SheetPage />
    </Suspense>
  );
}
