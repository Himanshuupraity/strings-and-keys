"use client";

import { MAX_RECORDING_SEC, pickMimeType } from "./format";
import { micRegistry } from "@/hooks/use-mic";

/**
 * Microphone recorder (MediaRecorder). Permission is only requested from `start()` (a button tap);
 * tracks are always stopped afterwards. Audio is kept in memory, then saved to on-device storage.
 */
export type RecordMode = "instrument" | "voice";

export interface RecorderResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
}

export function recordingSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export class Recorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buf: Float32Array<ArrayBuffer> = new Float32Array(0);
  private startedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private resolveStop: ((r: RecorderResult | null) => void) | null = null;
  /** Shows the global "microphone on" indicator (with its Stop button) while recording. */
  private unregisterMic: (() => void) | null = null;
  mimeType = "";

  get recording() {
    return this.rec?.state === "recording";
  }

  elapsed(now = performance.now()) {
    return this.startedAt ? (now - this.startedAt) / 1000 : 0;
  }

  async start(mode: RecordMode, onAutoStop?: () => void): Promise<void> {
    // Instrument: raw sound (no processing that would dull a guitar/piano). Voice: cleaner speech-style processing.
    const audio: MediaTrackConstraints =
      mode === "voice" ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    this.unregisterMic = micRegistry.register(() => void this.stop());
    const mime = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
    this.rec = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream);
    this.mimeType = this.rec.mimeType || mime || "audio/webm";
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.onstop = () => {
      const durationSec = this.elapsed();
      const blob = new Blob(this.chunks, { type: this.mimeType });
      this.cleanup();
      this.resolveStop?.(blob.size ? { blob, mimeType: this.mimeType, durationSec } : null);
      this.resolveStop = null;
    };
    // Level meter.
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.ctx.createMediaStreamSource(this.stream).connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.rec.start(1000);
    this.startedAt = performance.now();
    this.timer = setTimeout(() => {
      onAutoStop?.();
      void this.stop();
    }, MAX_RECORDING_SEC * 1000);
  }

  level(): number {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let s = 0;
    for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
    return Math.sqrt(s / this.buf.length);
  }

  stop(): Promise<RecorderResult | null> {
    if (!this.rec || this.rec.state === "inactive") {
      this.cleanup();
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      this.resolveStop = resolve;
      this.rec!.stop();
    });
  }

  /** Discard without saving (unmount / cancel). */
  cancel() {
    this.resolveStop = null;
    if (this.rec && this.rec.state !== "inactive") {
      this.rec.onstop = null;
      this.rec.stop();
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.unregisterMic?.();
    this.unregisterMic = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
    this.startedAt = 0;
  }
}
