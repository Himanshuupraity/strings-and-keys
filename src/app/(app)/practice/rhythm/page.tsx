import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { BackToPractice } from "@/components/practice/back-link";
import { RhythmTrainer } from "@/components/practice/rhythm-trainer";

export const metadata: Metadata = { title: "Rhythm trainer" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <PageHeader title="Rhythm trainer" description="Tap along with rhythm patterns and see exactly how early or late each hit was." />
      <RhythmTrainer />
    </>
  );
}
