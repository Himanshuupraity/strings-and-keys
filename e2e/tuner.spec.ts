import { expect, test } from "@playwright/test";
import { denyMicrophone, mockMicrophone, seedPrefs } from "./helpers";

test("guitar tuner detects a mocked A2 (110 Hz) signal", async ({ page }) => {
  await seedPrefs(page);
  await mockMicrophone(page, 110);
  await page.goto("/tuner");
  await page.getByTestId("mic-start").first().click();
  await expect(page.getByTestId("mic-indicator")).toBeVisible();
  await expect(page.getByTestId("tuner-note")).toContainText("A", { timeout: 15_000 });
  await expect(page.getByTestId("tuner-note")).toContainText("2");
  const cents = Number((await page.getByTestId("tuner-cents").innerText()).replace(/[^\d.+-]/g, ""));
  expect(Math.abs(cents)).toBeLessThan(10);
  // Stopping releases the microphone
  await page.getByTestId("mic-indicator").click();
  await expect(page.getByTestId("mic-indicator")).toHaveCount(0);
});

test("microphone denial is handled gracefully", async ({ page }) => {
  await seedPrefs(page);
  await denyMicrophone(page);
  await page.goto("/tuner");
  await page.getByTestId("mic-start").first().click();
  await expect(page.getByTestId("mic-error")).toContainText(/blocked|allow/i);
  await expect(page.getByTestId("mic-indicator")).toHaveCount(0);
  // The rest of the page still works
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
