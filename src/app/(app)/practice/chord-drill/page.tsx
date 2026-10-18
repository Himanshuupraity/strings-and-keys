import type { Metadata } from "next";
import { ChordDrill } from "@/components/guitar/chord-drill";
import { TPageHeader } from "@/components/ui/t-page-header";
import { BackToPractice } from "@/components/practice/back-link";

export const metadata: Metadata = { title: "1-Minute Chord Change Drill" };

export default function ChordDrillPage() {
  return (
    <div>
      <BackToPractice />
      <TPageHeader eyebrowKey="eyebrow.guitarPractice" titleKey="ui.1_minute_chord_change_drill" descriptionKey="tool.desc.chordDrill" />
      <ChordDrill />
    </div>
  );
}
