import type { Metadata } from "next";
import { BackToPractice } from "@/components/practice/back-link";
import { PracticeTimer } from "@/components/practice/practice-timer";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Practice timer" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <TPageHeader titleKey="tool.timer" descriptionKey="tool.desc.timer" />
      <PracticeTimer />
    </>
  );
}
