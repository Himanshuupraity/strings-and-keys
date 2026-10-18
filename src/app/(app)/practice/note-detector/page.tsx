import type { Metadata } from "next";
import { BackToPractice } from "@/components/practice/back-link";
import { NoteDetector } from "@/components/practice/note-detector";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Piano note detector" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <TPageHeader titleKey="tool.noteDetector" descriptionKey="tool.desc.noteDetector" />
      <NoteDetector />
    </>
  );
}
