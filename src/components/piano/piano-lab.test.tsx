import { describe, expect, it, beforeAll, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";

vi.mock("@/lib/audio/engine", () => ({
  pianoAttack: vi.fn(async () => {}),
  pianoRelease: vi.fn(),
  playPianoNote: vi.fn(async () => {}),
  playPianoChord: vi.fn(async () => {}),
  ensureAudio: vi.fn(async () => ({})),
  getAudioContext: () => null,
  scheduleClick: vi.fn(),
}));

import { PianoLab } from "./piano-lab";
import { __resetPrefsCache } from "@/lib/storage/prefs";

beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  __resetPrefsCache();
});

const keyCount = () => document.querySelectorAll('[aria-label^="Piano keyboard"] [data-midi]').length;

describe("PianoLab", () => {
  it("renders the selected preset with exactly that many keys and persists the size", () => {
    render(<PianoLab />);
    expect(keyCount()).toBe(61);
    act(() => fireEvent.click(screen.getByTestId("size-88")));
    expect(keyCount()).toBe(88);
    expect(JSON.parse(localStorage.getItem("mm:prefs")!).keyboardSize).toBe(88);
    act(() => fireEvent.click(screen.getByTestId("size-49")));
    expect(keyCount()).toBe(49);
    const middleC = document.querySelectorAll('[data-midi="60"]');
    expect(middleC).toHaveLength(1);
    expect(middleC[0].getAttribute("aria-label")).toContain("middle C");
  });

  it("shows played notes in free play and runs the five-finger exercise", async () => {
    render(<PianoLab />);
    const c4 = document.querySelector('[data-midi="60"]')!;
    act(() => fireEvent.pointerDown(c4, { pointerId: 1 }));
    expect(screen.getByTestId("now-playing").textContent).toContain("C4");
    act(() => fireEvent.pointerUp(c4, { pointerId: 1 }));

    act(() => fireEvent.click(screen.getByTestId("piano-mode-exercises")));
    act(() => fireEvent.click(screen.getByTestId("exercise-piano-five-finger-c")));
    for (const m of [60, 62, 64, 65, 67]) {
      const key = document.querySelector(`[data-midi="${m}"]`)!;
      act(() => fireEvent.pointerDown(key, { pointerId: 1 }));
      act(() => fireEvent.pointerUp(key, { pointerId: 1 }));
    }
    expect(await screen.findByText(/exercise complete/i)).toBeTruthy();
    expect(screen.getByText(/100% right on the first try/)).toBeTruthy();
  });
});
