import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { BackToPractice } from "@/components/practice/back-link";
import { ScaleTrainer } from "@/components/practice/scale-trainer";

export const metadata: Metadata = { title: "Scale trainer" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <PageHeader title="Scale trainer" description="Play a scale one note at a time. Accuracy first, then speed." />
      <ScaleTrainer />
    </>
  );
}
