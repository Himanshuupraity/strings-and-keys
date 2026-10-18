import { expect, test } from "@playwright/test";
import { seedPrefs } from "./helpers";

const ROUTES = [
  "/", "/dashboard", "/learn", "/learn/guitar", "/lesson/l0-what-is-music", "/lesson/g2-string-6-low-e",
  "/piano-lab", "/guitar-lab", "/guitar-lab?tab=capo", "/guitar-lab?tab=exercises", "/tuner",
  "/practice", "/practice/metronome", "/practice/note-detector", "/practice/chord-drill",
  "/songs", "/songs/bw-chart-kesariya", "/songs/sheet?new=1", "/videos", "/ai-coach", "/progress", "/settings",
];

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("no page scrolls sideways at 360px", async ({ page }) => {
    await seedPrefs(page);
    for (const r of ROUTES) {
      await page.goto(r);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${r} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test("text fields are at least 16px (no iOS zoom on focus)", async ({ page }) => {
    await seedPrefs(page);
    for (const r of ["/songs", "/songs/sheet?new=1", "/guitar-lab?tab=capo", "/practice/timer"]) {
      await page.goto(r);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll("input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select")].filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).length,
      );
      expect(small, r).toBe(0);
    }
  });
});

test("mobile: bottom navigation works", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("navigation", { name: "Quick" })).toBeVisible();
  await page.getByRole("navigation", { name: "Quick" }).getByRole("link", { name: /Practice/ }).click();
  await expect(page).toHaveURL(/\/practice/);
});
