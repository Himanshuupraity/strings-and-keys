import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { PracticeHub } from "@/components/practice/practice-hub";

export const metadata: Metadata = { title: "Practice toolkit" };

export default function PracticePage() {
  return (
    <>
      <PageHeader eyebrow="Practice" title="Practice toolkit" description="Short, focused tools for daily practice. Everything works with the virtual instruments; the microphone and MIDI keyboards are optional extras." />
      <PracticeHub />
    </>
  );
}
