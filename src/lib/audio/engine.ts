"use client";

import { midiToFrequency, nameToMidi } from "@/lib/music/notes";
import { loadPrefs, subscribePrefs } from "@/lib/storage/prefs";

/**
 * Sound output. Tone.js is loaded lazily (it needs `window`), and audio only starts after a user
 * gesture via `ensureAudio()` — browsers block autoplay otherwise.
 */
type ToneNS = typeof import("tone");

let tone: ToneNS | null = null;
let loading: Promise<ToneNS> | null = null;
let piano: import("tone").PolySynth | null = null;
let pianoBus: import("tone").Volume | null = null;
let sampler: import("tone").Sampler | null = null;
let guitarVoices: import("tone").PluckSynth[] = [];
let guitarBody: import("tone").Filter | null = null;
let master: import("tone").Volume | null = null;
let voiceIdx = 0;
let volumeDb = -6;

/* ---------------- Recorded piano (Salamander Grand Piano, CC BY 3.0) ---------------- */

/**
 * 30 samples, one every minor third from A0 to C8 (A, C, D#, F# per octave). Tone.Sampler
 * pitch-shifts the nearest sample, so no key is ever more than 1 semitone from a real recording.
 * Served from /samples/piano/ so it works offline and doesn't depend on a third-party CDN.
 */
export const PIANO_SAMPLE_NOTES: string[] = ["A0", ...[1, 2, 3, 4, 5, 6, 7].flatMap((o) => [`C${o}`, `D#${o}`, `F#${o}`, `A${o}`]), "C8"];
export const PIANO_SAMPLE_BASE_URL = "/samples/piano/";
/** Total download size of the samples (MB), shown in Settings. */
export const PIANO_SAMPLES_MB = 2.0;

/** File name for a sample note ("D#4" -> "Ds4.mp3"). */
export function pianoSampleFile(note: string): string {
  return `${note.replace("#", "s")}.mp3`;
}

export function pianoSampleUrls(): Record<string, string> {
  return Object.fromEntries(PIANO_SAMPLE_NOTES.map((n) => [n, pianoSampleFile(n)]));
}

/** Distance in semitones from a MIDI note to the nearest sample (for tests / diagnostics). */
export function nearestSampleDistance(midi: number): number {
  return Math.min(...PIANO_SAMPLE_NOTES.map((n) => Math.abs(nameToMidi(n) - midi)));
}

export type PianoSamplesStatus = "idle" | "loading" | "ready" | "error" | "off";
let samplesStatus: PianoSamplesStatus = "idle";
const samplesListeners = new Set<() => void>();

function setSamplesStatus(s: PianoSamplesStatus) {
  samplesStatus = s;
  samplesListeners.forEach((l) => l());
}

/** "idle" until the first sound, "loading", "ready", "error" (synth used), or "off" (synth chosen). */
export function pianoSamplesStatus(): PianoSamplesStatus {
  return loadPrefs().pianoSound === "synth" ? "off" : samplesStatus;
}

export function subscribePianoSamples(fn: () => void): () => void {
  samplesListeners.add(fn);
  const unsub = subscribePrefs(fn);
  return () => {
    samplesListeners.delete(fn);
    unsub();
  };
}

function wantSamples() {
  return loadPrefs().pianoSound !== "synth";
}

/** Starts downloading the samples (only after a user gesture, to save mobile data). */
function loadSampler(T: ToneNS) {
  if (sampler || !pianoBus || samplesStatus === "loading") return;
  setSamplesStatus("loading");
  try {
    sampler = new T.Sampler({
      urls: pianoSampleUrls(),
      baseUrl: PIANO_SAMPLE_BASE_URL,
      release: 1.1,
      attack: 0,
      curve: "exponential",
      onload: () => setSamplesStatus("ready"),
      onerror: () => {
        sampler?.dispose();
        sampler = null;
        setSamplesStatus("error");
      },
    }).connect(pianoBus);
  } catch {
    sampler = null;
    setSamplesStatus("error");
  }
}

let prefsHooked = false;
function hookPrefs(T: ToneNS) {
  if (prefsHooked) return;
  prefsHooked = true;
  subscribePrefs(() => {
    if (wantSamples() && !sampler && samplesStatus !== "loading") {
      if (samplesStatus === "error") samplesStatus = "idle";
      loadSampler(T);
    }
  });
}

/** Which instrument plays the piano right now: the recorded sampler when ready, otherwise the synth. */
function pianoVoice(): "sampler" | "synth" {
  return wantSamples() && sampler && samplesStatus === "ready" && sampler.loaded ? "sampler" : "synth";
}

/** Notes currently held, and which instrument started them (so release goes to the same one). */
const heldBy = new Map<number, "sampler" | "synth">();

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
    // Recorded piano bus (a little less reverb feel comes from the samples' own room sound).
    pianoBus = new T.Volume(-3).connect(reverb);
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
  hookPrefs(T);
  if (wantSamples()) loadSampler(T);
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
  const midi = toMidi(note);
  const f = midiToFrequency(midi);
  // Re-striking a held key: stop the old voice first.
  if (heldBy.has(midi)) pianoRelease(midi);
  const voice = pianoVoice();
  heldBy.set(midi, voice);
  if (voice === "sampler") sampler!.triggerAttack(f, undefined, velocity);
  else piano!.triggerAttack(f, undefined, velocity);
}

export function pianoRelease(note: number | string) {
  const midi = toMidi(note);
  const f = midiToFrequency(midi);
  const voice = heldBy.get(midi);
  heldBy.delete(midi);
  if (voice === "sampler") sampler?.triggerRelease(f);
  else piano?.triggerRelease(f);
}

export async function playPianoNote(note: number | string, duration = 0.6, delay = 0, velocity = 0.8) {
  const T = await ensureAudio();
  const f = midiToFrequency(toMidi(note));
  // Recorded notes ring a little longer so short demo notes still sound like a piano.
  if (pianoVoice() === "sampler") sampler!.triggerAttackRelease(f, Math.max(duration, 0.35), T.now() + delay, velocity);
  else piano!.triggerAttackRelease(f, duration, T.now() + delay, velocity);
}

export async function playPianoChord(notes: (number | string)[], duration = 1.2, delay = 0) {
  const T = await ensureAudio();
  const fs = notes.map((n) => midiToFrequency(toMidi(n)));
  if (pianoVoice() === "sampler") sampler!.triggerAttackRelease(fs, duration, T.now() + delay, 0.7);
  else piano!.triggerAttackRelease(fs, duration, T.now() + delay, 0.7);
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
  sampler?.releaseAll();
  heldBy.clear();
}
