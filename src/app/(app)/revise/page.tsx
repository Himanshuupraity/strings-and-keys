import type { Metadata } from "next";
import { RevisionSession } from "@/components/revision/revision-session";

export const metadata: Metadata = { title: "Revise" };

export default function RevisePage() {
  return <RevisionSession />;
}
