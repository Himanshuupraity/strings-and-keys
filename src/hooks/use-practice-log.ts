"use client";

import { useCallback, useEffect, useRef } from "react";
import { practiceRepo } from "@/lib/storage/repositories";
import { usePrefs } from "./use-prefs";

/**
 * Automatically logs practice time for interactive pages. Call `ping()` on every meaningful
 * interaction (note played, exercise answered). Time only counts while active: gaps longer than
 * `idleSec` are not counted. Sessions shorter than 30 s are discarded. Saved on unmount / tab hide.
 */
export function usePracticeLog(activity: string, opts: { lessonId?: string; idleSec?: number; instrument?: "guitar" | "piano" } = {}) {
  const [prefs] = usePrefs();
  const instrument = opts.instrument ?? prefs.instrument;
  const state = useRef({ start: 0, last: 0, active: 0 });
  const idle = (opts.idleSec ?? 45) * 1000;
  const meta = useRef({ activity, lessonId: opts.lessonId, instrument });
  useEffect(() => {
    meta.current = { activity, lessonId: opts.lessonId, instrument };
  });

  const flush = useCallback(() => {
    const s = state.current;
    if (!s.start) return;
    const durationSec = Math.round(s.active / 1000);
    const startedAt = new Date(s.start).toISOString();
    const endedAt = new Date(s.last).toISOString();
    state.current = { start: 0, last: 0, active: 0 };
    if (durationSec < 30) return;
    void practiceRepo.add({ instrument: meta.current.instrument, activity: meta.current.activity, lessonId: meta.current.lessonId, startedAt, endedAt, durationSec });
  }, []);

  const ping = useCallback(() => {
    const now = Date.now();
    const s = state.current;
    if (!s.start) {
      state.current = { start: now, last: now, active: 0 };
      return;
    }
    const gap = now - s.last;
    s.active += Math.min(gap, idle);
    s.last = now;
  }, [idle]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return { ping, flush };
}
