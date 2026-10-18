import type { Metadata } from "next";
import { BackToPractice } from "@/components/practice/back-link";
import { RhythmTrainer } from "@/components/practice/rhythm-trainer";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Rhythm trainer" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <TPageHeader titleKey="tool.rhythm" descriptionKey="tool.desc.rhythm" />
      <RhythmTrainer />
    </>
  );
}
