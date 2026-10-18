import { expect, test } from "@playwright/test";

test("first visit asks for a name, remembers it, and greets the learner", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("learner-name").fill("Asha");
  await page.getByTestId("learner-continue").click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Asha");
  await expect(page.getByTestId("learner-chip")).toContainText("Asha");
  // Reopening the site skips the name screen.
  await page.goto("/");
  await expect(page.getByTestId("welcome-back")).toContainText("Asha");
});

test("validates the name", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("learner-continue").click();
  await expect(page.locator("#learner-name-error")).toContainText(/enter your name/i);
});

test("new device: shows saved names and continues with that learner's progress", async ({ page }) => {
  const id = "7d3f7a52-2c58-4b2a-9d1b-6f1d2a9c1e11";
  const bundle = {
    app: "melody-masters",
    version: 1,
    exportedAt: "2026-10-18T10:00:00.000Z",
    prefs: { instrument: "piano", onboarded: true },
    collections: {
      practiceSessions: [{ key: "ps_1", value: { id: "ps_1", instrument: "piano", activity: "Piano Lab", startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationSec: 900 } }],
    },
  };
  const saved: unknown[] = [];
  await page.route("**/api/learners", (route) =>
    route.fulfill({ json: { enabled: true, learners: [{ id, name: "Asha", updatedAt: new Date(Date.now() - 864e5).toISOString() }] } }),
  );
  await page.route(`**/api/learners/${id}`, async (route) => {
    if (route.request().method() === "PUT") {
      saved.push(route.request().postDataJSON());
      return route.fulfill({ json: { updatedAt: new Date().toISOString() } });
    }
    return route.fulfill({ json: { learner: { id, name: "Asha", updatedAt: "2026-10-18T10:00:00.000Z" }, data: bundle } });
  });

  await page.goto("/");
  const list = page.getByTestId("learner-list");
  await expect(list).toContainText("Asha");
  await list.getByRole("button", { name: /Asha/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Asha");
  // Their progress came with them: piano mode and 15 minutes of piano practice.
  await expect(page.getByTestId("mode-piano").first()).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("15 min").first()).toBeVisible();
  await expect(page.getByTestId("learner-chip")).toContainText("Asha");

  // New progress uploads automatically.
  await page.getByTestId("mode-guitar").first().click();
  await expect.poll(() => saved.length, { timeout: 8000 }).toBeGreaterThan(0);
});
