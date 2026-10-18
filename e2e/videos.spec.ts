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

test("'Hindi piano lessons' quick pick shows only Hindi piano videos", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/videos");
  await page.getByTestId("pick-hindi-piano").click();
  await expect(page.getByTestId("pick-hindi-piano")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("video-language")).toHaveValue("hindi");
  await expect(page.getByRole("combobox", { name: "Instrument" })).toHaveValue("piano");
  expect(await page.getByText("Hindi", { exact: true }).count()).toBeGreaterThanOrEqual(40);
});
