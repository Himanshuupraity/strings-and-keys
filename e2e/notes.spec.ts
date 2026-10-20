import { expect, test } from "@playwright/test";
import { seedPrefs } from "./helpers";

test("write a guitar tab with the keypad, save it and see it drawn", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/notes?i=guitar");
  await page.getByTestId("new-tab").click();
  await page.getByLabel("Song", { exact: true }).fill("Riff practice");

  // B string, first beat: 1 1 → "11", next beat: 9
  await page.locator('[data-cell="0:1"]').first().click();
  await page.getByTestId("key-1").click();
  await page.getByTestId("key-1").click();
  await page.getByTestId("key-next").click();
  await page.getByTestId("key-9").click();
  await expect(page.locator('[data-cell="0:1"]').first()).toHaveText("11");
  await expect(page.locator('[data-cell="1:1"]').first()).toHaveText("9");

  await page.getByTestId("note-save").click();
  await expect(page).toHaveURL(/\/notes\/note\?id=/);
  await expect(page.getByTestId("note-title")).toHaveText("Riff practice");
  await expect(page.getByTestId("tab-view")).toContainText("11");

  await page.getByRole("link", { name: "All notes" }).click();
  await expect(page.getByTestId("notes-list")).toContainText("Riff practice");
});

test("import a text tab", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/notes/note?new=tab");
  await page.getByRole("button", { name: "Paste text tab" }).click();
  await page.getByTestId("tab-import-text").fill(["[Solo]", "e|-6-7-6-|", "B|-------|", "G|-------|", "D|-------|", "A|-------|", "E|-------|"].join("\n"));
  await page.getByRole("button", { name: "Add to my tab" }).click();
  await expect(page.getByTestId("tab-section")).toHaveCount(1);
  await expect(page.getByLabel("Section name (Intro, Verse…)")).toHaveValue("Solo");
  await expect(page.locator('[data-cell="1:0"]')).toHaveText("7");
});

test("chord sheet: tap chord chips to place chords over the words", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/notes/note?new=chords");
  await page.getByLabel("Song", { exact: true }).fill("My chords");
  const text = page.getByTestId("chords-text");
  await text.fill("[Verse]\nwords to sing");
  await text.press("End");
  await page.getByTestId("chord-chips").getByRole("button", { name: "Am", exact: true }).click();
  await expect(text).toHaveValue("[Verse]\nwords to sing[Am]");
  await page.getByTestId("note-save").click();
  await expect(page.getByTestId("chords-view").locator('[data-chord="Am"]')).toBeVisible();
});

test("piano notes: note pad writes into the line, notes used are listed", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/notes?i=piano");
  await page.getByTestId("new-piano").click();
  await page.getByLabel("Song", { exact: true }).fill("Melody");
  await page.getByLabel("Lyric, line 1").fill("Kiska hai yeh");
  await page.getByTestId("piano-notes-input").first().click();
  for (const n of ["A", "A#", "C"]) await page.getByTestId(`note-${n}`).click();
  await expect(page.getByTestId("piano-notes-input").first()).toHaveValue("A A# C ");
  await page.getByTestId("note-save").click();
  await expect(page.getByTestId("notes-used")).toHaveText("C  A  A#");
  await expect(page.getByTestId("piano-view")).toContainText("Kiska hai yeh");
});
