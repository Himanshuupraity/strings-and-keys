import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { BackToPractice } from "@/components/practice/back-link";
import { PracticeTimer } from "@/components/practice/practice-timer";

export const metadata: Metadata = { title: "Practice timer" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <PageHeader title="Practice timer" description="Time your practice sessions and watch your weekly progress grow." />
      <PracticeTimer />
    </>
  );
}
