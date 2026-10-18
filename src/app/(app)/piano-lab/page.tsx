import type { Metadata } from "next";
import { PianoLab } from "@/components/piano/piano-lab";

export const metadata: Metadata = {
  title: "Piano Lab",
  description: "A playable 49/61/88-key piano with Western and Sargam labels, MIDI input and guided exercises.",
};

export default function PianoLabPage() {
  return <PianoLab />;
}
