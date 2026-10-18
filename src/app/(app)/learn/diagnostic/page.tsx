import type { Metadata } from "next";
import { DiagnosticQuiz } from "@/components/onboarding/diagnostic-quiz";

export const metadata: Metadata = { title: "Placement quiz" };

export default function DiagnosticPage() {
  return <DiagnosticQuiz />;
}
