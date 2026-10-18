import type { Metadata } from "next";
import { PracticeHub } from "@/components/practice/practice-hub";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Practice toolkit" };

export default function PracticePage() {
  return (
    <>
      <TPageHeader eyebrowKey="eyebrow.practice" titleKey="practice.title" description="Short, focused tools for daily practice. Everything works with the virtual instruments; the microphone and MIDI keyboards are optional extras." />
      <PracticeHub />
    </>
  );
}
