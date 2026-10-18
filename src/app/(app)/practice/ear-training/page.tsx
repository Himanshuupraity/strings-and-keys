import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { BackToPractice } from "@/components/practice/back-link";
import { EarTraining } from "@/components/practice/ear-training";

export const metadata: Metadata = { title: "Ear-training lab" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <PageHeader title="Ear-training lab" description="Train your ears to recognise pitches, intervals, chords, melodies and swaras." />
      <EarTraining />
    </>
  );
}
