import { expect, test } from "@playwright/test";
import { seedPrefs } from "./helpers";

test("new user completes onboarding and lands on the first lesson", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByTestId("onboarding")).toBeVisible();
  await page.getByTestId("ob-next").click(); // welcome
  await page.getByTestId("ob-piano").click();
  for (let i = 0; i < 10; i++) {
    if (await page.getByTestId("ob-finish").isVisible()) break;
    await page.getByTestId("ob-next").click();
  }
  await page.getByTestId("ob-finish").click();
  await expect(page).toHaveURL(/\/lesson\//);
  // Preferences were saved: piano mode and onboarded
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("mm:prefs") || "{}"));
  expect(prefs.instrument).toBe("piano");
  expect(prefs.onboarded).toBe(true);
});

test("completing a beginner lesson saves progress that survives a reload", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/lesson/l0-what-is-music");
  // Walk the explain/listen steps, then open the exercise.
  for (const step of ["Music is organised sound", "Hear a melody", "Hear harmony", "Hear rhythm"]) {
    await expect(page.getByRole("button", { name: step })).toBeVisible();
    await page.getByTestId("lesson-next").click();
  }
  await page.getByTestId("ear-start").click();
  const answers = page.getByRole("group", { name: "Answers" });
  for (let r = 0; r < 5; r++) {
    await answers.getByRole("button").first().click();
    const nextRound = page.getByRole("button", { name: "Next round" });
    if (await nextRound.isVisible()) await nextRound.click();
  }
  await page.getByTestId("lesson-next").click(); // Go to quiz
  for (const k of [1, 0, 1]) {
    await page.getByTestId(`quiz-option-${k}`).click();
    await page.getByTestId("quiz-next").click();
  }
  await expect(page.getByTestId("quiz-result")).toBeVisible();
  await page.getByTestId("lesson-finish").click();
  await expect(page.getByTestId("lesson-summary")).toContainText(/complete/i);

  await page.goto("/progress");
  await page.getByRole("radio", { name: "Music theory" }).click();
  await expect(page.getByRole("link", { name: /What is music\?.*quiz 100%/ })).toBeVisible();
  await page.reload();
  await page.getByRole("radio", { name: "Music theory" }).click();
  await expect(page.getByRole("link", { name: /What is music\?.*quiz 100%/ })).toBeVisible();
});

test("practice timer saves a session to history", async ({ page }) => {
  await seedPrefs(page);
  await page.clock.install();
  await page.goto("/practice/timer");
  await page.getByTestId("timer-start").click();
  await page.clock.fastForward("02:05");
  await page.getByTestId("timer-end").click();
  await expect(page.getByTestId("session-history")).toContainText(/2 min|2:0/);
  await page.reload();
  await expect(page.getByTestId("session-history")).toBeVisible();
});
