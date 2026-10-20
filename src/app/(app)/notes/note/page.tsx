import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { NotePage } from "@/components/notes/note-page";

export const metadata: Metadata = { title: "Note" };

export default function NoteRoute() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <NotePage />
    </Suspense>
  );
}
