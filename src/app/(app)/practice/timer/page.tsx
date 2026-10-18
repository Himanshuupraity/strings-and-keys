import type { Metadata } from "next";
import { BackToPractice } from "@/components/practice/back-link";
import { PracticeTimer } from "@/components/practice/practice-timer";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Practice timer" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <TPageHeader titleKey="tool.timer" description="Time your practice sessions and watch your weekly progress grow." />
      <PracticeTimer />
    </>
  );
}
