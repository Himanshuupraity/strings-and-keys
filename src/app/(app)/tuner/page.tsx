import type { Metadata } from "next";
import { GuitarTuner } from "@/components/tuner/guitar-tuner";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Guitar tuner" };

export default function TunerPage() {
  return (
    <>
      <TPageHeader eyebrowKey="common.practiceToolkit" titleKey="tuner.title" description="Uses your microphone to measure the pitch of each string and tells you whether to tighten or loosen it. Standard tuning is E A D G B E, from the thickest string to the thinnest." />
      <GuitarTuner />
    </>
  );
}
