import type { Metadata } from "next";
import { BackToPractice } from "@/components/practice/back-link";
import { EarTraining } from "@/components/practice/ear-training";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Ear-training lab" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <TPageHeader titleKey="tool.ear" description="Train your ears to recognise pitches, intervals, chords, melodies and swaras." />
      <EarTraining />
    </>
  );
}
