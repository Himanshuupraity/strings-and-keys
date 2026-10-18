import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { BackToPractice } from "@/components/practice/back-link";
import { MetronomeTool } from "@/components/practice/metronome-tool";

export const metadata: Metadata = { title: "Metronome" };

export default function Page() {
  return (
    <>
      <BackToPractice />
      <PageHeader title="Metronome" description="Keep steady time. Start slow, play cleanly, then speed up 5 BPM at a time." />
      <MetronomeTool />
    </>
  );
}
