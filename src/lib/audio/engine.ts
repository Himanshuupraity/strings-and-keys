"use client";

import { midiToFrequency, nameToMidi } from "@/lib/music/notes";

/**
 * Sound output. Tone.js is loaded lazily (it needs `window`), and audio only starts after a user
 * gesture via `ensureAudio()` — browsers block autoplay otherwise.
 */
type ToneNS = typeof import("tone");

let tone: ToneNS | null = null;
let loading: Promise<ToneNS> | null = null;
let piano: import("tone").PolySynth | null = null;
let guitarVoices: import("tone").PluckSynth[] = [];
let guitarBody: import("tone").Filter | null = null;
let master: import("tone").Volume | null = null;
let voiceIdx = 0;
let volumeDb = -6;

export async function loadTone(): Promise<ToneNS> {
  if (tone) return tone;
  if (!loading) loading = import("tone").then((t) => (tone = t));
  return loading;
}

export async function ensureAudio(): Promise<ToneNS> {
  const T = await loadTone();
  if (T.getContext().state !== "running") await T.start();
  if (!master) {
    master = new T.Volume(volumeDb).toDestination();
    const reverb = new T.Reverb({ decay: 1.8, wet: 0.18 }).connect(master);
    piano = new T.PolySynth(T.Synth, {
      oscillator: { type: "fmtriangle", modulationType: "sine", harmonicity: 2, modulationIndex: 1.2 } as never,
      envelope: { attack: 0.004, decay: 0.9, sustain: 0.18, release: 1.3 },
    }).connect(reverb);
    piano.maxPolyphony = 32;
    piano.volume.value = -8;
    guitarBody = new T.Filter({ frequency: 3200, type: "lowpass", rolloff: -12 }).connect(reverb);
    guitarVoices = Array.from({ length: 8 }, () => {
      const p = new T.PluckSynth({ attackNoise: 1.2, dampening: 3800, resonance: 0.97, release: 1 });
      p.volume.value = -2;
      return p.connect(guitarBody!);
    });
  }
  return T;
}

export function audioReady(): boolean {
  return !!tone && tone.getContext().state === "running" && !!master;
}

export function setMasterVolume(v: number) {
  volumeDb = v <= 0 ? -Infinity : 20 * Math.log10(v);
  if (master) master.volume.value = volumeDb;
}

export function getAudioContext(): AudioContext | null {
  return (tone?.getContext().rawContext as AudioContext | undefined) ?? null;
}

const toMidi = (n: number | string) => (typeof n === "number" ? n : nameToMidi(n));

/* ---------------- Piano ---------------- */

export async function pianoAttack(note: number | string, velocity = 0.8) {
  await ensureAudio();
  piano!.triggerAttack(midiToFrequency(toMidi(note)), undefined, velocity);
}

export function pianoRelease(note: number | string) {
  piano?.triggerRelease(midiToFrequency(toMidi(note)));
}

export async function playPianoNote(note: number | string, duration = 0.6, delay = 0, velocity = 0.8) {
  const T = await ensureAudio();
  piano!.triggerAttackRelease(midiToFrequency(toMidi(note)), duration, T.now() + delay, velocity);
}

export async function playPianoChord(notes: (number | string)[], duration = 1.2, delay = 0) {
  const T = await ensureAudio();
  piano!.triggerAttackRelease(notes.map((n) => midiToFrequency(toMidi(n))), duration, T.now() + delay, 0.7);
}

/* ---------------- Guitar ---------------- */

export async function playGuitarNote(note: number | string, delay = 0, duration = 1.5) {
  const T = await ensureAudio();
  const v = guitarVoices[voiceIdx++ % guitarVoices.length];
  v.triggerAttackRelease(midiToFrequency(toMidi(note)), duration, T.now() + delay);
}

/** Strum notes low→high (down) or high→low (up) with a small spread like a real pick. */
export async function strum(notes: (number | string)[], direction: "down" | "up" = "down", spread = 0.028, delay = 0) {
  const ordered = [...notes].map(toMidi).sort((a, b) => a - b);
  if (direction === "up") ordered.reverse();
  await ensureAudio();
  ordered.forEach((n, i) => void playGuitarNote(n, delay + i * spread));
}

/* ---------------- Generic helpers ---------------- */

export async function playNote(instrument: "piano" | "guitar", note: number | string, delay = 0, duration = 0.6) {
  return instrument === "guitar" ? playGuitarNote(note, delay, Math.max(duration, 1)) : playPianoNote(note, duration, delay);
}

/** Play a melody; returns total duration in seconds. */
export async function playSequence(instrument: "piano" | "guitar", notes: (number | string)[], step = 0.5): Promise<number> {
  await ensureAudio();
  notes.forEach((n, i) => void playNote(instrument, n, i * step, step * 0.9));
  return notes.length * step;
}

/** A short click for metronomes / rhythm, scheduled at an absolute AudioContext time. */
export function scheduleClick(ctx: BaseAudioContext, time: number, accent: boolean, destination?: AudioNode) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = accent ? 1760 : 1100;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.28, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  osc.connect(gain).connect(destination ?? ctx.destination);
  osc.start(time);
  osc.stop(time + 0.06);
}

export function stopAll() {
  piano?.releaseAll();
}
