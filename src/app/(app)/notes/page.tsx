import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { NotesHome } from "@/components/notes/notes-home";

export const metadata: Metadata = { title: "Notes" };

export default function NotesRoute() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <NotesHome />
    </Suspense>
  );
}
