import type { Metadata } from "next";
import { BackToPractice } from "@/components/practice/back-link";
import { ScaleTrainer } from "@/components/practice/scale-trainer";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Scale trainer" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <TPageHeader titleKey="tool.scale" description="Play a scale one note at a time. Accuracy first, then speed." />
      <ScaleTrainer />
    </>
  );
}
