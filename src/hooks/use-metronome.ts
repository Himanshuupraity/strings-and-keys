"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureAudio, getAudioContext, scheduleClick } from "@/lib/audio/engine";
import { BeatScheduler, clampBpm, type BeatEvent } from "@/lib/audio/scheduler";

export interface MetronomeState {
  running: boolean;
  bpm: number;
  beatsPerBar: number;
  accent: boolean;
  /** Beat currently sounding (0-based), -1 when stopped. */
  beat: number;
  bar: number;
}

/**
 * Metronome bound to the shared audio context. `onBeat` fires (on the UI thread) close to when each
 * beat actually sounds, with the precise audio time for timing comparisons.
 */
export function useMetronome(initial: { bpm?: number; beatsPerBar?: number; accent?: boolean; muted?: boolean } = {}, onBeat?: (e: BeatEvent & { audioTime: number }) => void) {
  const [state, setState] = useState<MetronomeState>({
    running: false,
    bpm: clampBpm(initial.bpm ?? 80),
    beatsPerBar: initial.beatsPerBar ?? 4,
    accent: initial.accent ?? true,
    beat: -1,
    bar: 0,
  });
  const sched = useRef<BeatScheduler | null>(null);
  const timeouts = useRef<number[]>([]);
  const mutedRef = useRef(!!initial.muted);
  const onBeatRef = useRef(onBeat);
  useEffect(() => {
    onBeatRef.current = onBeat;
  });

  const stop = useCallback(() => {
    sched.current?.stop();
    sched.current = null;
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    setState((s) => ({ ...s, running: false, beat: -1, bar: 0 }));
  }, []);

  const start = useCallback(async () => {
    await ensureAudio();
    const ctx = getAudioContext();
    if (!ctx || sched.current) return;
    const s = new BeatScheduler(
      { now: () => ctx.currentTime },
      {
        bpm: state.bpm,
        beatsPerBar: state.beatsPerBar,
        accentFirst: state.accent,
        onSchedule: (e) => {
          if (!mutedRef.current) scheduleClick(ctx, e.time, e.accent);
          const delay = Math.max(0, (e.time - ctx.currentTime) * 1000);
          const id = window.setTimeout(() => {
            setState((st) => ({ ...st, beat: e.beatInBar, bar: e.bar }));
            onBeatRef.current?.({ ...e, audioTime: e.time });
          }, delay);
          timeouts.current.push(id);
          if (timeouts.current.length > 64) timeouts.current.splice(0, 32);
        },
      },
    );
    sched.current = s;
    s.start();
    setState((st) => ({ ...st, running: true }));
  }, [state.bpm, state.beatsPerBar, state.accent]);

  const setBpm = useCallback((bpm: number) => {
    const b = clampBpm(bpm);
    sched.current?.setBpm(b);
    setState((s) => ({ ...s, bpm: b }));
  }, []);
  const setBeatsPerBar = useCallback((n: number) => {
    sched.current?.setBeatsPerBar(n);
    setState((s) => ({ ...s, beatsPerBar: n }));
  }, []);
  const setAccent = useCallback((a: boolean) => {
    sched.current?.setAccent(a);
    setState((s) => ({ ...s, accent: a }));
  }, []);
  const setMuted = useCallback((m: boolean) => {
    mutedRef.current = m;
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { ...state, start, stop, setBpm, setBeatsPerBar, setAccent, setMuted, toggle: () => (state.running ? stop() : void start()) };
}
