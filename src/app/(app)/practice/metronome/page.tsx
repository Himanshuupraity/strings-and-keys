import type { Metadata } from "next";
import { BackToPractice } from "@/components/practice/back-link";
import { MetronomeTool } from "@/components/practice/metronome-tool";
import { TPageHeader } from "@/components/ui/t-page-header";

export const metadata: Metadata = { title: "Metronome" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <TPageHeader titleKey="tool.metronome" description="Keep steady time. Start slow, play cleanly, then speed up 5 BPM at a time." />
      <MetronomeTool />
    </>
  );
}
