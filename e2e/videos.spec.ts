import { expect, test } from "@playwright/test";
import { seedPrefs } from "./helpers";

test("Video Hub has Hindi lessons and a Hindi-only filter", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/videos");
  await page.getByTestId("video-language").selectOption("hindi");
  // Every remaining video card carries the Hindi badge.
  const titles = page.getByText("Hindi", { exact: true });
  await expect(titles.first()).toBeVisible();
  expect(await titles.count()).toBeGreaterThanOrEqual(30);
  await page.getByTestId("video-language").selectOption("english");
  await expect(page.getByText("Hindi", { exact: true })).toHaveCount(0);
});
