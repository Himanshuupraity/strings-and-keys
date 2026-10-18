import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LESSONS, getLesson } from "@/content/curriculum";
import { LessonPlayer } from "@/components/lesson/lesson-player";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/lesson/[id]">): Promise<Metadata> {
  const { id } = await params;
  const lesson = getLesson(id);
  return lesson ? { title: lesson.title, description: lesson.summary } : { title: "Lesson not found" };
}

export default async function LessonPage({ params }: PageProps<"/lesson/[id]">) {
  const { id } = await params;
  if (!getLesson(id)) notFound();
  return <LessonPlayer lessonId={id} />;
}
