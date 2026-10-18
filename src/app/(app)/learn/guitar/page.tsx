import type { Metadata } from "next";
import { CoursePage } from "@/components/learn/course-page";

export const metadata: Metadata = { title: "Guitar course" };

export default function GuitarCoursePage() {
  return <CoursePage instrument="guitar" />;
}
