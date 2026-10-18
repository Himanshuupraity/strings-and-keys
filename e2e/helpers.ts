import type { Page } from "@playwright/test";

/** Replace getUserMedia with a synthetic tone (real Web Audio signal, so pitch detection actually runs). */
export async function mockMicrophone(page: Page, frequency: number) {
  await page.addInitScript((freq) => {
    const fake = async () => {
      const Ctx = window.AudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const lp = ctx.createBiquadFilter();
      lp.frequency.value = 1500;
      const gain = ctx.createGain();
      gain.gain.value = 0.4;
      const dest = ctx.createMediaStreamDestination();
      osc.connect(lp).connect(gain).connect(dest);
      osc.start();
      return dest.stream;
    };
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: fake, enumerateDevices: async () => [] }, configurable: true });
  }, frequency);
}

export async function denyMicrophone(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: async () => { throw new DOMException("Permission denied", "NotAllowedError"); } },
      configurable: true,
    });
  });
}

/** Skip the name screen and onboarding prompts by seeding a local learner + prefs. */
export async function seedPrefs(page: Page, prefs: Record<string, unknown> = {}) {
  await page.addInitScript((p) => {
    if (!localStorage.getItem("mm:prefs")) localStorage.setItem("mm:prefs", JSON.stringify({ onboarded: true, ...p }));
    if (!localStorage.getItem("mm:learner")) localStorage.setItem("mm:learner", JSON.stringify({ id: null, name: "Tester", syncedAt: null, dirty: false }));
  }, prefs);
}
