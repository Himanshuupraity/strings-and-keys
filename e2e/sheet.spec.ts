import { expect, test, type Page } from "@playwright/test";
import { mockSinging, seedPrefs } from "./helpers";

// Original practice text written for this test (not lyrics from any song).
const SHEET = `[Verse]
Am              F
Paste the words under the chords
C                    G
just like on a chord website
F            G
the third line follows after
[Chorus]
[C]Inline chords [G]work too`;

async function createSheet(page: Page) {
  await page.goto("/songs/sheet?new=1");
  await page.getByLabel("Title").fill("My Practice Song");
  await page.getByLabel("YouTube link (optional)").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByTestId("sheet-text").fill(SHEET);
  await expect(page.getByText("4 chords: Am F C G")).toBeVisible();
  await page.getByTestId("sheet-save").click();
  await expect(page).toHaveURL(/\/songs\/sheet\?id=/);
}

const activeLine = (page: Page) => page.locator("[data-testid=song-sheet] [data-active]");

test("paste lyrics with chords, view the sheet, navigate, and it is saved", async ({ page }) => {
  await seedPrefs(page);
  await createSheet(page);
  const sheet = page.getByTestId("song-sheet");
  await expect(sheet.locator('[data-line-text="Paste the words under the chords"]')).toBeVisible();
  await expect(sheet.locator('[data-chord="F"]').first()).toBeVisible();
  await expect(activeLine(page)).toHaveAttribute("data-line-text", "Paste the words under the chords");
  await page.getByTestId("mode-manual").click();
  await page.keyboard.press("ArrowDown");
  await expect(activeLine(page)).toHaveAttribute("data-line-text", "just like on a chord website");
  // YouTube player offered beside the lyrics (loads only on click)
  await expect(page.getByRole("button", { name: "Load the YouTube video" })).toBeVisible();
  // Saved: appears under My songs after reload
  await page.goto("/songs");
  await page.getByRole("radio", { name: /My songs/ }).click();
  await expect(page.getByText("My Practice Song")).toBeVisible();
  await expect(page.getByText("Lyrics + chords", { exact: true })).toBeVisible();
});

test("follow my voice moves to the next line after each sung phrase", async ({ page }) => {
  await seedPrefs(page);
  await mockSinging(page);
  await createSheet(page);
  await expect(activeLine(page)).toHaveAttribute("data-line-text", "Paste the words under the chords");
  await page.getByTestId("mic-start").click();
  await expect(page.getByTestId("voice-status")).toBeVisible();
  // After the quiet calibration, each simulated phrase + pause advances one line.
  await expect(activeLine(page)).toHaveAttribute("data-line-text", "just like on a chord website", { timeout: 8000 });
  await expect(activeLine(page)).toHaveAttribute("data-line-text", "the third line follows after", { timeout: 6000 });
  await page.getByTestId("mic-stop").click();
});

test("a chord chart page offers 'Sing along with lyrics' with chords pre-filled", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/songs/bw-chart-kesariya");
  await page.getByTestId("sing-along").click();
  await expect(page).toHaveURL(/\/songs\/sheet\?new=1&chart=bw-chart-kesariya/);
  await expect(page.getByLabel("Title")).toHaveValue("Kesariya");
  await expect(page.getByTestId("sheet-text")).toHaveValue(/\[Verse\]/);
});

test("a chords-only sheet guides you to add the lyrics", async ({ page }) => {
  await seedPrefs(page);
  await page.goto("/songs/sheet?new=1&chart=bw-chart-tum-hi-ho");
  await expect(page.getByTestId("editor-find-lyrics")).toHaveAttribute("href", /google\.com\/search\?q=Tum%20Hi%20Ho.*lyrics%20chords/);
  await page.getByTestId("sheet-save").click();
  await expect(page).toHaveURL(/\/songs\/sheet\?id=/);
  await expect(page.getByText("Add the lyrics to sing along")).toBeVisible();
  await expect(page.getByTestId("find-lyrics")).toHaveAttribute("href", /lyrics%20chords/);
});
