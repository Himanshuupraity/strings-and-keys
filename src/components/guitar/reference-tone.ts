"use client";

import { ensureAudio, getAudioContext } from "@/lib/audio/engine";

/**
 * Pure reference tone at an exact frequency (respects the user's A4 calibration, unlike the
 * synth instruments which use A4 = 440). Gentle sine with a few harmonics, 2 seconds.
 */
export async function playReferenceTone(frequency: number, seconds = 2) {
  await ensureAudio();
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
  out.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  out.connect(ctx.destination);
  [1, 2, 3].forEach((h, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = frequency * h;
    g.gain.value = [1, 0.35, 0.15][i];
    osc.connect(g).connect(out);
    osc.start(now);
    osc.stop(now + seconds + 0.05);
  });
}
