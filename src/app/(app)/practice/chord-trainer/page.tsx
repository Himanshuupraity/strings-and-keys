import type { Metadata } from "next";
import { BackToPractice } from "@/components/practice/back-link";
import { ChordTrainer } from "@/components/practice/chord-trainer";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Chord trainer" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <TPageHeader titleKey="tool.chord" description="Play the target chord and get feedback on missing and unwanted notes." />
      <ChordTrainer />
    </>
  );
}
