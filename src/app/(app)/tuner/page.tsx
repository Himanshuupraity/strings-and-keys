import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { GuitarTuner } from "@/components/tuner/guitar-tuner";

export const metadata: Metadata = { title: "Guitar tuner" };

export default function TunerPage() {
  return (
    <>
      <PageHeader eyebrow="Practice toolkit" title="Guitar tuner" description="Uses your microphone to measure the pitch of each string and tells you whether to tighten or loosen it. Standard tuning is E A D G B E, from the thickest string to the thinnest." />
      <GuitarTuner />
    </>
  );
}
