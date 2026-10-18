/**
 * Seeds the lesson catalogue (courses, lessons, exercises, quiz questions) from the curriculum
 * source files in src/content/curriculum. Idempotent: run as often as you like.
 *
 *   DATABASE_URL=... npm run db:seed
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { COURSES, LESSONS } from "../src/content/curriculum";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — nothing to seed (the app works without a database).");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    for (const c of Object.values(COURSES)) {
      const data = { title: c.title, description: c.description, levels: c.levels };
      await db.course.upsert({ where: { track: c.track }, create: { track: c.track, ...data }, update: data });
    }
    let exercises = 0;
    let questions = 0;
    for (const l of LESSONS) {
      const data = {
        track: l.track,
        level: l.level,
        order: l.order,
        title: l.title,
        summary: l.summary,
        minutes: l.minutes,
        skills: l.skills,
        prerequisites: l.prerequisites,
        topics: l.topics,
        passScore: l.passScore,
      };
      const exerciseRows = l.steps.flatMap((s) =>
        s.kind === "exercise"
          ? [{ id: `${l.id}:${s.id}`, stepId: s.id, title: s.title, type: s.exercise.type, mastery: !!s.mastery, passAccuracy: s.passAccuracy ?? null, spec: JSON.parse(JSON.stringify(s.exercise)) }]
          : [],
      );
      const quizRows = l.quiz.map((q, i) => ({ id: `${l.id}:${q.id}`, position: i, question: q.question, options: q.options, answer: q.answer, explanation: q.explanation }));
      await db.$transaction([
        db.lesson.upsert({ where: { id: l.id }, create: { id: l.id, ...data }, update: data }),
        // Replace child rows so removed exercises/questions disappear too.
        db.exercise.deleteMany({ where: { lessonId: l.id } }),
        db.quizQuestion.deleteMany({ where: { lessonId: l.id } }),
        db.exercise.createMany({ data: exerciseRows.map((e) => ({ ...e, lessonId: l.id })) }),
        db.quizQuestion.createMany({ data: quizRows.map((q) => ({ ...q, lessonId: l.id })) }),
      ]);
      exercises += exerciseRows.length;
      questions += quizRows.length;
    }
    // Lessons removed from the curriculum are deleted from the catalogue (progress rows are kept).
    await db.lesson.deleteMany({ where: { id: { notIn: LESSONS.map((l) => l.id) } } });
    console.log(`Seeded ${Object.keys(COURSES).length} courses, ${LESSONS.length} lessons, ${exercises} exercises, ${questions} quiz questions.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
