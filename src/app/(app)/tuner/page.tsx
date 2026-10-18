import type { Metadata } from "next";
import { GuitarTuner } from "@/components/tuner/guitar-tuner";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Guitar tuner" };

export default function TunerPage() {
  return (
    <>
      <TPageHeader eyebrowKey="common.practiceToolkit" titleKey="tuner.title" descriptionKey="tool.desc.tuner" />
      <GuitarTuner />
    </>
  );
}
