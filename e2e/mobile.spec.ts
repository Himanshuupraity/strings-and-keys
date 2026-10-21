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

for (const [name, route, group] of [
  ["piano keys", "/piano-lab", "Piano keyboard"],
  ["guitar fretboard", "/guitar-lab", "Guitar fretboard"],
] as const) {
  test(`mobile: ${name} can be scrolled with the arrows and the drag bar`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await seedPrefs(page);
    await page.goto(route);
    const scroller = page.getByRole("group", { name: group }).first().locator("..");
    const pos = () => scroller.evaluate((el) => el.scrollLeft);
    await scroller.evaluate((el) => el.scrollTo({ left: 0 }));
    await page.getByRole("button", { name: "Scroll right" }).first().click();
    await expect.poll(pos).toBeGreaterThan(0);
    const bar = page.getByTitle("Drag to see more").first();
    const box = (await bar.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 2, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect.poll(pos).toBe(0);
  });
}
