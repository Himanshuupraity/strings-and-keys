import type { Metadata } from "next";
import { PracticeHub } from "@/components/practice/practice-hub";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Practice toolkit" };

export default function PracticePage() {
  return (
    <>
      <TPageHeader eyebrowKey="eyebrow.practice" titleKey="practice.title" descriptionKey="tool.desc.practice" />
      <PracticeHub />
    </>
  );
}
