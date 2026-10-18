import { describe, expect, it, vi, beforeAll } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { LEVEL_0 } from "@/content/curriculum/level-0";
import { LEVEL_1 } from "@/content/curriculum/level-1";
import { LEVEL_2 } from "@/content/curriculum/level-2";
import { LEVEL_3 } from "@/content/curriculum/level-3";
import { LessonPlayer } from "./lesson-player";
import { progressRepo } from "@/lib/storage/repositories";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/lib/audio/engine", () => ({
  ensureAudio: vi.fn(async () => ({})),
  getAudioContext: () => null,
  playSequence: vi.fn(async () => 0),
  playPianoChord: vi.fn(async () => {}),
  playNote: vi.fn(async () => {}),
  playGuitarNote: vi.fn(async () => {}),
  pianoAttack: vi.fn(async () => {}),
  pianoRelease: vi.fn(),
  strum: vi.fn(async () => {}),
  scheduleClick: vi.fn(),
  setMasterVolume: vi.fn(),
}));

beforeAll(() => {
  window.scrollTo = vi.fn() as never;
  Element.prototype.scrollIntoView = vi.fn();
});

const ALL = [...LEVEL_0, ...LEVEL_1, ...LEVEL_2, ...LEVEL_3];

describe("LessonPlayer renders every step of every level 0–3 lesson", () => {
  it.each(ALL.map((l) => [l.id, l] as const))("%s", async (_id, lesson) => {
    // Unlock by marking prerequisites complete.
    for (const p of lesson.prerequisites) {
      const pl = ALL.find((x) => x.id === p);
      if (pl) await progressRepo.mutate(pl, (x) => ({ ...x, status: "completed", completedAt: new Date().toISOString() }));
    }
    render(<LessonPlayer lessonId={lesson.id} />);
    const rail = await screen.findByRole("navigation", { name: "Lesson steps" });
    const buttons = within(rail).getAllByRole("button");
    expect(buttons.length).toBe(lesson.steps.length + (lesson.quiz.length ? 1 : 0));
    for (let i = 0; i < lesson.steps.length; i++) {
      await act(async () => fireEvent.click(within(rail).getAllByRole("button")[i]));
      expect(screen.getByRole("heading", { level: 2, name: lesson.steps[i].title })).toBeTruthy();
    }
    // Quiz: answer everything correctly → pass.
    await act(async () => fireEvent.click(within(rail).getAllByRole("button").at(-1)!));
    for (const q of lesson.quiz) {
      await act(async () => fireEvent.click(screen.getByTestId(`quiz-option-${q.answer}`)));
      await act(async () => fireEvent.click(screen.getByTestId("quiz-next")));
    }
    await screen.findByTestId("quiz-result");
    await waitFor(async () => expect((await progressRepo.get(lesson.id))?.quizBest).toBe(1));
    await act(async () => fireEvent.click(screen.getByTestId("lesson-finish")));
    await screen.findByTestId("lesson-summary");
    cleanup();
  });
});
