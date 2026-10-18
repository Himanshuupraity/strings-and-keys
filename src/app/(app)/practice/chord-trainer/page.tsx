import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { BackToPractice } from "@/components/practice/back-link";
import { ChordTrainer } from "@/components/practice/chord-trainer";

export const metadata: Metadata = { title: "Chord trainer" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <PageHeader title="Chord trainer" description="Play the target chord and get feedback on missing and unwanted notes." />
      <ChordTrainer />
    </>
  );
}
