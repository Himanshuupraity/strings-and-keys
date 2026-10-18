-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Instrument" AS ENUM ('guitar', 'piano');

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('theory', 'guitar', 'piano');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'mastered');

-- CreateEnum
CREATE TYPE "AttemptKind" AS ENUM ('quiz', 'exercise');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "userId" TEXT NOT NULL,
    "prefs" JSONB,
    "profile" JSONB,
    "goals" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "InstrumentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrument" "Instrument" NOT NULL,
    "placementLevel" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstrumentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "track" "Track" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "levels" INTEGER[],

    CONSTRAINT "Course_pkey" PRIMARY KEY ("track")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "level" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "skills" TEXT[],
    "prerequisites" TEXT[],
    "topics" TEXT[],
    "passScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mastery" BOOLEAN NOT NULL DEFAULT false,
    "passAccuracy" DOUBLE PRECISION,
    "spec" JSONB NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "answer" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonCompletion" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'not_started',
    "stepsDone" TEXT[],
    "quizBest" DOUBLE PRECISION,
    "quizAttempts" INTEGER NOT NULL DEFAULT 0,
    "exerciseBest" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "masteredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonCompletion_pkey" PRIMARY KEY ("userId","lessonId")
);

-- CreateTable
CREATE TABLE "PracticeSession" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "instrument" "Instrument" NOT NULL,
    "activity" TEXT NOT NULL,
    "lessonId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "kind" "AttemptKind" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lessonId" TEXT,
    "exerciseId" TEXT,
    "instrument" TEXT,
    "skill" TEXT,
    "input" TEXT,
    "correct" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "timingErrorMs" DOUBLE PRECISION,
    "measured" BOOLEAN NOT NULL DEFAULT false,
    "wrongQuestionIds" TEXT[],
    "details" TEXT,

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "SkillMastery" (
    "userId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "level" DOUBLE PRECISION NOT NULL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillMastery_pkey" PRIMARY KEY ("userId","skill")
);

-- CreateTable
CREATE TABLE "SavedSong" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSong_pkey" PRIMARY KEY ("userId","key")
);

-- CreateTable
CREATE TABLE "SongProgress" (
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "instrument" "Instrument" NOT NULL,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "sectionsPracticed" TEXT[],
    "bestTempo" DOUBLE PRECISION,
    "minutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastPracticed" TIMESTAMP(3),

    CONSTRAINT "SongProgress_pkey" PRIMARY KEY ("userId","songId","instrument")
);

-- CreateTable
CREATE TABLE "SavedVideo" (
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedVideo_pkey" PRIMARY KEY ("userId","videoId")
);

-- CreateTable
CREATE TABLE "ChordDrillResult" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "chordA" TEXT NOT NULL,
    "chordB" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "transitions" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "confirmedByAudio" INTEGER,
    "confirmedManually" INTEGER,
    "cleanRate" DOUBLE PRECISION,
    "untimed" BOOLEAN,

    CONSTRAINT "ChordDrillResult_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "Transposition" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "progression" TEXT[],
    "originalKey" TEXT NOT NULL,
    "capo" INTEGER NOT NULL,
    "shapes" TEXT[],
    "label" TEXT,

    CONSTRAINT "Transposition_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT,

    CONSTRAINT "CoachMessage_pkey" PRIMARY KEY ("userId","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentProfile_userId_instrument_key" ON "InstrumentProfile"("userId", "instrument");

-- CreateIndex
CREATE INDEX "Lesson_track_level_order_idx" ON "Lesson"("track", "level", "order");

-- CreateIndex
CREATE INDEX "Exercise_lessonId_idx" ON "Exercise"("lessonId");

-- CreateIndex
CREATE INDEX "QuizQuestion_lessonId_idx" ON "QuizQuestion"("lessonId");

-- CreateIndex
CREATE INDEX "PracticeSession_userId_startedAt_idx" ON "PracticeSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_userId_date_idx" ON "AssessmentAttempt"("userId", "date");

-- CreateIndex
CREATE INDEX "ChordDrillResult_userId_date_idx" ON "ChordDrillResult"("userId", "date");

-- CreateIndex
CREATE INDEX "CoachMessage_userId_date_idx" ON "CoachMessage"("userId", "date");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentProfile" ADD CONSTRAINT "InstrumentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_track_fkey" FOREIGN KEY ("track") REFERENCES "Course"("track") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCompletion" ADD CONSTRAINT "LessonCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMastery" ADD CONSTRAINT "SkillMastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSong" ADD CONSTRAINT "SavedSong_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongProgress" ADD CONSTRAINT "SongProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedVideo" ADD CONSTRAINT "SavedVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChordDrillResult" ADD CONSTRAINT "ChordDrillResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transposition" ADD CONSTRAINT "Transposition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachMessage" ADD CONSTRAINT "CoachMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
