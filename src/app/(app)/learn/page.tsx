import type { Metadata } from "next";
import { LearnOverview } from "@/components/learn/learn-overview";

export const metadata: Metadata = { title: "Curriculum" };

export default function LearnPage() {
  return <LearnOverview />;
}
