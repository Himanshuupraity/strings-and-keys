import { expect, test } from "@playwright/test";
import { seedPrefs } from "./helpers";

test("virtual piano: keys play, show note names, and size presets change the key count", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/piano-lab");
  const middleC = page.locator('[data-midi="60"]').first();
  await middleC.dispatchEvent("pointerdown", { pointerId: 1, buttons: 1 });
  await expect(page.getByTestId("now-playing")).toContainText("C4");
  await middleC.dispatchEvent("pointerup", { pointerId: 1 });

  for (const size of [49, 88, 61]) {
    await page.getByRole("radiogroup", { name: "Keyboard size" }).getByRole("radio", { name: String(size) }).click();
    await expect(page.locator("[data-midi]")).toHaveCount(size);
  }
  await page.reload();
  await expect(page.locator("[data-midi]")).toHaveCount(61);
});

test("computer keyboard plays notes", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/piano-lab");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/Computer keys:/)).toBeVisible();
  await page.keyboard.down("a");
  await expect(page.getByTestId("now-playing")).toContainText("C4");
  await page.keyboard.up("a");
});
