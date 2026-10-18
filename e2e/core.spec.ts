import { expect, test } from "@playwright/test";
import { seedPrefs } from "./helpers";

test("switching between guitar and piano mode persists across reloads", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/dashboard");
  await page.getByTestId("mode-piano").first().click();
  await expect(page.getByTestId("mode-piano").first()).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(/Piano · Level/)).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("mode-piano").first()).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("mode-guitar").first().click();
  await expect(page.getByText(/Guitar · Level/)).toBeVisible();
});

test("theme toggle switches dark/light and is remembered", async ({ page }) => {
  await seedPrefs(page, { theme: "light" });
  await page.goto("/settings");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByTestId("theme-dark").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByTestId("theme-light").click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("Sargam labels and tonic preference persist", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/settings");
  await page.getByTestId("label-both").click();
  await page.getByTestId("tonic-select").selectOption("2");
  await page.reload();
  await expect(page.getByTestId("label-both")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("D — Sa").first()).toBeVisible();
});

test("dashboard labels sample data when there is no history", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
});
