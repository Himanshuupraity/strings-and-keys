import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { BackToPractice } from "@/components/practice/back-link";
import { NoteDetector } from "@/components/practice/note-detector";

export const metadata: Metadata = { title: "Piano note detector" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <PageHeader title="Piano note detector" description="Play a single note on your piano or keyboard and check whether it matches the target." />
      <NoteDetector />
    </>
  );
}
