"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeMicError, MicListener, type ChromaFrame, type MicErrorKind, type PitchFrame } from "@/lib/audio/microphone";

export type MicStatus = "idle" | "starting" | "listening" | "error";

/** Global registry so the header can show a "microphone on" indicator with a stop button. */
const activeMics = new Map<symbol, () => void>();
const micListeners = new Set<() => void>();
const emitMic = () => micListeners.forEach((l) => l());
export const micRegistry = {
  count: () => activeMics.size,
  stopAll: () => [...activeMics.values()].forEach((s) => s()),
  subscribe: (fn: () => void) => {
    micListeners.add(fn);
    return () => micListeners.delete(fn);
  },
};

/**
 * Microphone lifecycle: permission is requested only when `start()` is called (from a button),
 * tracks are stopped on `stop()` and on unmount.
 */
export function useMic(opts: { a4?: number; mode?: "pitch" | "chroma" | "both"; voice?: boolean; onPitch?: (f: PitchFrame) => void; onChroma?: (f: ChromaFrame) => void } = {}) {
  const listener = useRef<MicListener | null>(null);
  const [status, setStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState<{ kind: MicErrorKind; message: string } | null>(null);
  const [pitch, setPitch] = useState<PitchFrame | null>(null);
  const [chroma, setChroma] = useState<ChromaFrame | null>(null);
  const cbs = useRef(opts);
  const token = useRef(Symbol("mic"));
  useEffect(() => {
    cbs.current = opts;
  });

  const stop = useCallback(() => {
    listener.current?.stop();
    listener.current = null;
    activeMics.delete(token.current);
    emitMic();
    setStatus("idle");
    setPitch(null);
    setChroma(null);
  }, []);

  const start = useCallback(async () => {
    if (listener.current?.active) return;
    setStatus("starting");
    setError(null);
    const l = new MicListener({ a4: cbs.current.a4 ?? 440, voice: cbs.current.voice ?? false });
    try {
      await l.start();
    } catch (e) {
      setError(describeMicError(e));
      setStatus("error");
      return;
    }
    listener.current = l;
    activeMics.set(token.current, stop);
    emitMic();
    setStatus("listening");
    let frame = 0;
    l.loop(() => {
      frame++;
      const mode = cbs.current.mode ?? "pitch";
      if (mode !== "chroma") {
        const p = l.readPitch();
        cbs.current.onPitch?.(p);
        if (frame % 2 === 0) setPitch(p);
      }
      if (mode !== "pitch" && frame % 3 === 0) {
        const c = l.readChroma();
        cbs.current.onChroma?.(c);
        setChroma(c);
      }
    });
  }, [stop]);

  useEffect(() => {
    listener.current?.setA4(opts.a4 ?? 440);
  }, [opts.a4]);

  useEffect(() => {
    const t = token.current;
    return () => {
      listener.current?.stop();
      activeMics.delete(t);
      emitMic();
    };
  }, []);

  return { status, error, pitch, chroma, start, stop, listening: status === "listening" };
}
