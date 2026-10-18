import { expect, test } from "@playwright/test";
import { seedPrefs } from "./helpers";

test("Song Lab opens on Hindi & Bollywood with chord charts first", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/songs");
  await expect(page.getByTestId("tab-hindi")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("heading", { name: "Bollywood songs", exact: true })).toBeVisible();
  await expect(page.getByTestId("song-card-bw-chart-tum-hi-ho")).toBeVisible();
  // English classics are kept out of the way in their own tab.
  await expect(page.getByText("Twinkle Twinkle Little Star")).toHaveCount(0);
  await page.getByTestId("tab-english").click();
  await expect(page.getByText("Twinkle Twinkle Little Star")).toBeVisible();
});

test("search finds songs by title, film or singer, and decades filter the list", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/songs");
  const search = page.getByRole("textbox", { name: "Search songs" });
  await search.fill("Sholay");
  await expect(page.getByTestId("song-card-bw-chart-yeh-dosti")).toBeVisible();
  await search.fill("lata");
  await expect(page.getByTestId("catalogue-list")).toContainText("Ajeeb Dastan Hai Yeh");
  await search.fill("");
  await page.getByRole("button", { name: "1960s" }).click();
  await expect(page.getByTestId("catalogue-list")).toContainText("Chaudhvin Ka Chand");
  await expect(page.getByTestId("catalogue-list")).not.toContainText("Kesariya");
});

test("a chord chart page shows its sources and suggested capo", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/songs/bw-chart-tum-hi-ho");
  await expect(page.getByRole("heading", { name: "Tum Hi Ho", level: 1 })).toBeVisible();
  await expect(page.getByText("About this chord chart")).toBeVisible();
  await expect(page.getByText(/capo on fret 1/).first()).toBeVisible();
});

test("catalogue songs can be added with your own chords (editor pre-filled)", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/songs");
  await page.getByRole("textbox", { name: "Search songs" }).fill("Chaudhvin");
  await page.getByRole("link", { name: /Add chords for Chaudhvin Ka Chand/ }).click();
  await expect(page).toHaveURL(/\/songs\/custom\?new=1/);
  await expect(page.locator('input[value="Chaudhvin Ka Chand"]')).toBeVisible();
});
