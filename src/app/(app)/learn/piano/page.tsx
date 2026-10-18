import type { Metadata } from "next";
import { CoursePage } from "@/components/learn/course-page";

export const metadata: Metadata = { title: "Piano course" };

export default function PianoCoursePage() {
  return <CoursePage instrument="piano" />;
}
