"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureAudio, getAudioContext, playGuitarNote, playPianoChord, playPianoNote, scheduleClick, strum } from "@/lib/audio/engine";
import { BeatScheduler, clampBpm } from "@/lib/audio/scheduler";
import { pianoAccompaniment, strumAccompaniment, type AccompEvent, type PianoPattern, type Timeline } from "./playback";

export interface PlayerSettings {
  bpm: number;
  loop: boolean;
  melody: boolean;
  chords: boolean;
  click: boolean;
  instrument: "guitar" | "piano";
  pianoPattern: PianoPattern;
  strumPattern: string;
}

interface AbsEvent extends AccompEvent {
  at: number;
}

/**
 * Plays a song timeline on the audio clock (look-ahead scheduling, eighth-note grid), with looping
 * and live tempo changes. `beatNow()` returns the precise song position for play-along judging.
 */
export function useSongPlayer(tl: Timeline, beatsPerBar: number, settings: PlayerSettings, hooks: { onPass?: (bpm: number) => void; onTick?: () => void } = {}) {
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);
  const [passes, setPasses] = useState(0);
  const sched = useRef<BeatScheduler | null>(null);
  const timeouts = useRef<number[]>([]);
  const anchor = useRef<{ time: number; beat: number; spb: number } | null>(null);
  const s = useRef(settings);
  const h = useRef(hooks);
  useEffect(() => {
    s.current = settings;
    h.current = hooks;
  });

  const accomp = useMemo(() => {
    const out: { guitar: AbsEvent[]; piano: AbsEvent[] } = { guitar: [], piano: [] };
    for (const c of tl.chords) {
      for (const e of strumAccompaniment(c.chord, c.beats, settings.strumPattern)) out.guitar.push({ ...e, at: c.start + e.offset });
      for (const e of pianoAccompaniment(c.chord, c.beats, settings.pianoPattern)) out.piano.push({ ...e, at: c.start + e.offset });
    }
    return out;
  }, [tl, settings.strumPattern, settings.pianoPattern]);
  const accompRef = useRef(accomp);
  const tlRef = useRef(tl);
  useEffect(() => {
    accompRef.current = accomp;
    tlRef.current = tl;
  });

  const stop = useCallback(() => {
    sched.current?.stop();
    sched.current = null;
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    anchor.current = null;
    setPlaying(false);
    setBeat(null);
  }, []);

  const start = useCallback(async () => {
    await ensureAudio();
    const ctx = getAudioContext();
    if (!ctx || sched.current) return;
    const t = tlRef.current;
    const slots = Math.round((t.length - t.startBeat) / 0.5);
    if (slots <= 0) return;
    let lastPass = -1;
    const scheduler = new BeatScheduler(
      { now: () => ctx.currentTime },
      {
        bpm: clampBpm(s.current.bpm),
        beatsPerBar,
        accentFirst: true,
        subdivision: 2,
        onSchedule: (ev) => {
          const pass = Math.floor(ev.index / slots);
          if (!s.current.loop && pass > 0) {
            const id = window.setTimeout(() => {
              h.current.onPass?.(clampBpm(s.current.bpm));
              stop();
            }, Math.max(0, (ev.time - ctx.currentTime) * 1000));
            timeouts.current.push(id);
            scheduler.stop();
            return;
          }
          const b = t.startBeat + (ev.index % slots) * 0.5;
          const spb = 60 / clampBpm(s.current.bpm);
          anchor.current = { time: ev.time, beat: b, spb };
          const delayOf = (at: number) => Math.max(0, ev.time + (at - b) * spb - ctx.currentTime);
          const inSlot = (at: number) => at >= b - 1e-9 && at < b + 0.5 - 1e-9;
          // Click on quarter-note beats inside the song (not during pickup).
          if (s.current.click && b >= 0 && Number.isInteger(b)) scheduleClick(ctx, ev.time, b % beatsPerBar === 0);
          if (s.current.chords) {
            const list = s.current.instrument === "guitar" ? accompRef.current.guitar : accompRef.current.piano;
            for (const e of list) {
              if (!inSlot(e.at)) continue;
              if (s.current.instrument === "guitar") void strum(e.midis, e.direction ?? "down", 0.018, delayOf(e.at));
              else if (e.midis.length > 1) void playPianoChord(e.midis, e.duration * spb, delayOf(e.at));
              else void playPianoNote(e.midis[0], e.duration * spb, delayOf(e.at), 0.55);
            }
          }
          if (s.current.melody) {
            for (const n of t.notes) {
              if (n.midi === null || !inSlot(n.start)) continue;
              if (s.current.instrument === "guitar") void playGuitarNote(n.midi + (n.midi < 52 ? 12 : 0), delayOf(n.start), n.beats * spb);
              else void playPianoNote(n.midi, n.beats * spb * 0.95, delayOf(n.start), 0.9);
            }
          }
          const id = window.setTimeout(() => {
            setBeat(b);
            h.current.onTick?.();
            if (pass !== lastPass) {
              if (lastPass >= 0) {
                setPasses((p) => p + 1);
                h.current.onPass?.(clampBpm(s.current.bpm));
              }
              lastPass = pass;
            }
          }, Math.max(0, (ev.time - ctx.currentTime) * 1000));
          timeouts.current.push(id);
          if (timeouts.current.length > 200) timeouts.current.splice(0, 100);
        },
      },
    );
    sched.current = scheduler;
    scheduler.start(0.1);
    setPlaying(true);
  }, [beatsPerBar, stop]);

  // Live tempo changes.
  useEffect(() => {
    sched.current?.setBpm(settings.bpm);
  }, [settings.bpm]);

  // Restart when the timeline changes (section / transpose) while playing.
  useEffect(() => {
    if (!sched.current) return;
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl]);

  useEffect(() => () => stop(), [stop]);

  const beatNow = useCallback((): number | null => {
    const ctx = getAudioContext();
    const a = anchor.current;
    if (!ctx || !a) return null;
    return a.beat + (ctx.currentTime - a.time) / a.spb;
  }, []);

  return { playing, beat, passes, start, stop, toggle: () => (sched.current ? stop() : void start()), beatNow };
}
