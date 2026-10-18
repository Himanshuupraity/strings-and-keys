"use client";

import { PitchDetector } from "pitchy";
import { frequencyToNote, mod12, type DetectedNote } from "@/lib/music/notes";
import { identifyChord } from "@/lib/music/chords";

/**
 * Microphone analysis. Everything runs locally in the browser; audio is never recorded or uploaded.
 *
 * Honest limits:
 *  - Single clear notes: reliable pitch via McLeod pitch method (pitchy) when clarity is high.
 *  - Chords: we estimate a chromagram (energy per pitch class) — a best-effort guess with a
 *    confidence value, NOT a reliable transcription. Noisy rooms, overtones and quiet strings
 *    confuse it.
 *  - Technique (finger pressure, posture, fingering) cannot be measured from audio at all.
 */

export type MicErrorKind = "unsupported" | "denied" | "no-device" | "insecure" | "unknown";

export class MicError extends Error {
  constructor(readonly kind: MicErrorKind, message: string) {
    super(message);
  }
}

export function micSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function describeMicError(e: unknown): { kind: MicErrorKind; message: string } {
  if (e instanceof MicError) return { kind: e.kind, message: e.message };
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return { kind: "denied", message: "Microphone access was blocked. Allow it from the address-bar permission icon, then try again. Everything else still works without it." };
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return { kind: "no-device", message: "No microphone was found. Plug one in or use the virtual instrument / MIDI instead." };
  return { kind: "unknown", message: "The microphone could not be started. You can keep practising with the virtual instruments." };
}

export interface PitchFrame {
  /** RMS level 0..1 */
  level: number;
  /** Detected pitch, or null when silent/unclear */
  frequency: number | null;
  clarity: number;
  note: DetectedNote | null;
  /** Stable = same note for several frames */
  stable: boolean;
}

export interface ChromaFrame {
  level: number;
  chroma: number[]; // 12 values, max = 1
  activePcs: number[];
  best: { symbol: string; score: number } | null;
  /** 0..1 — how much the best guess beats alternatives and how strong the signal is. */
  confidence: number;
}

export interface MicOptions {
  a4?: number;
  minFrequency?: number;
  maxFrequency?: number;
  /** Clarity threshold for pitchy (0..1). */
  minClarity?: number;
  /** RMS gate below which we treat input as silence. */
  minLevel?: number;
  fftSize?: number;
}

export class MicListener {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private raf = 0;
  private buf: Float32Array<ArrayBuffer> = new Float32Array(0);
  private freq: Float32Array<ArrayBuffer> = new Float32Array(0);
  private detector: PitchDetector<Float32Array<ArrayBuffer>> | null = null;
  private history: number[] = [];
  private opts: Required<MicOptions>;

  constructor(opts: MicOptions = {}) {
    this.opts = { a4: 440, minFrequency: 60, maxFrequency: 1400, minClarity: 0.9, minLevel: 0.01, fftSize: 4096, ...opts };
  }

  get active() {
    return !!this.stream;
  }

  setA4(a4: number) {
    this.opts.a4 = a4;
  }

  async start(): Promise<void> {
    if (this.stream) return;
    if (typeof window !== "undefined" && !window.isSecureContext) throw new MicError("insecure", "The microphone needs a secure page (https or localhost).");
    if (!micSupported()) throw new MicError("unsupported", "This browser doesn't support microphone input.");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      const d = describeMicError(e);
      throw new MicError(d.kind, d.message);
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.opts.fftSize;
    this.analyser.smoothingTimeConstant = 0.6;
    this.source.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.freq = new Float32Array(this.analyser.frequencyBinCount);
    this.detector = PitchDetector.forFloat32Array(this.analyser.fftSize);
    this.detector.minVolumeDecibels = -45;
  }

  /** Stops microphone tracks and closes the audio context. Safe to call repeatedly. */
  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    try {
      this.source?.disconnect();
    } catch {
      /* noop */
    }
    this.source = null;
    this.analyser = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.history = [];
  }

  readPitch(): PitchFrame {
    if (!this.analyser || !this.ctx || !this.detector) return { level: 0, frequency: null, clarity: 0, note: null, stable: false };
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    const level = Math.sqrt(sum / this.buf.length);
    if (level < this.opts.minLevel) {
      this.history = [];
      return { level, frequency: null, clarity: 0, note: null, stable: false };
    }
    const [pitch, clarity] = this.detector.findPitch(this.buf, this.ctx.sampleRate);
    if (clarity < this.opts.minClarity || pitch < this.opts.minFrequency || pitch > this.opts.maxFrequency) {
      return { level, frequency: null, clarity, note: null, stable: false };
    }
    this.history.push(pitch);
    if (this.history.length > 7) this.history.shift();
    // Median smoothing for a calm needle.
    const sorted = [...this.history].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const note = frequencyToNote(median, this.opts.a4);
    const stable = this.history.length >= 4 && this.history.every((f) => Math.abs(1200 * Math.log2(f / median)) < 35);
    return { level, frequency: median, clarity, note, stable };
  }

  readChroma(): ChromaFrame {
    if (!this.analyser || !this.ctx) return { level: 0, chroma: Array(12).fill(0), activePcs: [], best: null, confidence: 0 };
    this.analyser.getFloatFrequencyData(this.freq);
    const binHz = this.ctx.sampleRate / this.analyser.fftSize;
    return chromaFromSpectrum(this.freq, binHz, this.opts.a4);
  }

  /** Calls `fn` every animation frame until stopped. */
  loop(fn: () => void) {
    cancelAnimationFrame(this.raf);
    const step = () => {
      fn();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}

/**
 * Pure: fold a dB spectrum into 12 pitch classes between 70 Hz and 2 kHz, then guess a chord.
 * Exported for unit tests with synthetic spectra.
 */
export function chromaFromSpectrum(db: Float32Array | number[], binHz: number, a4 = 440): ChromaFrame {
  const chroma = Array(12).fill(0) as number[];
  let energy = 0;
  for (let i = 1; i < db.length; i++) {
    const f = i * binHz;
    if (f < 70 || f > 2000) continue;
    const v = Math.pow(10, (db[i] as number) / 20); // amplitude
    if (!Number.isFinite(v)) continue;
    // Weight lower partials more (overtones of bass notes pollute upper pitch classes).
    const w = 1 / Math.sqrt(f / 100);
    const midi = 69 + 12 * Math.log2(f / a4);
    const nearest = Math.round(midi);
    if (Math.abs(midi - nearest) > 0.35) continue;
    chroma[mod12(nearest)] += v * w;
    energy += v * v;
  }
  const level = Math.sqrt(energy);
  const max = Math.max(...chroma);
  if (max <= 0 || level < 0.02) return { level, chroma: Array(12).fill(0), activePcs: [], best: null, confidence: 0 };
  const norm = chroma.map((c) => c / max);
  const activePcs = norm.map((v, pc) => [v, pc] as const).filter(([v]) => v > 0.45).map(([, pc]) => pc);
  const matches = identifyChord(activePcs);
  const best = matches[0] ?? null;
  const second = matches[1];
  const margin = best && second ? Math.max(0, best.score - second.score) : best ? 0.5 : 0;
  const strength = Math.min(1, level / 0.2);
  const confidence = best ? Math.max(0, Math.min(1, (best.score * 0.6 + margin) * strength)) : 0;
  return { level, chroma: norm, activePcs, best: best ? { symbol: best.symbol, score: best.score } : null, confidence };
}
