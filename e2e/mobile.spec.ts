import { expect, test } from "@playwright/test";
import { seedPrefs } from "./helpers";

test("mobile: bottom navigation and no horizontal page scroll", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("navigation", { name: "Quick" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole("navigation", { name: "Quick" }).getByRole("link", { name: /Practice/ }).click();
  await expect(page).toHaveURL(/\/practice/);
});
