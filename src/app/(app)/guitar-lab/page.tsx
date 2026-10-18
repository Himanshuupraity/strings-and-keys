import type { Metadata } from "next";
import { Suspense } from "react";
import { GuitarLab } from "@/components/guitar/guitar-lab";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Guitar Lab" };

export default function GuitarLabPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <GuitarLab />
    </Suspense>
  );
}
