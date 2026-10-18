import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChordDrill } from "@/components/guitar/chord-drill";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "1-Minute Chord Change Drill" };

export default function ChordDrillPage() {
  return (
    <div>
      <Link href="/practice" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" /> Practice toolkit
      </Link>
      <PageHeader
        eyebrow="Guitar · Practice"
        title="1-Minute Chord Change Drill"
        description="Build clean, relaxed chord changes. Learn both shapes, practise them slowly, then see how many clean changes you can make in 60 seconds."
      />
      <ChordDrill />
    </div>
  );
}
