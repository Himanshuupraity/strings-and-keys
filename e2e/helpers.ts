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

/** Simulated singer: a pitched tone that sings for `onMs`, pauses for `offMs`, repeatedly (after a quiet start). */
export async function mockSinging(page: Page, onMs = 1400, offMs = 1100, quietStartMs = 1600) {
  await page.addInitScript(({ onMs, offMs, quietStartMs }) => {
    const fake = async () => {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 220;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const dest = ctx.createMediaStreamDestination();
      osc.connect(gain).connect(dest);
      osc.start();
      const t0 = ctx.currentTime + quietStartMs / 1000;
      for (let i = 0; i < 40; i++) {
        const s = t0 + (i * (onMs + offMs)) / 1000;
        gain.gain.setValueAtTime(0.5, s);
        gain.gain.setValueAtTime(0, s + onMs / 1000);
      }
      return dest.stream;
    };
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: fake, enumerateDevices: async () => [] }, configurable: true });
  }, { onMs, offMs, quietStartMs });
}
