"use client";
import { useT, useTx } from "@/lib/i18n";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hand, Square } from "lucide-react";
import { Badge, Button, Callout, Segmented, Select, SourceTag, cn } from "@/components/ui";
import { useMetronome } from "@/hooks/use-metronome";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { getAudioContext, strum } from "@/lib/audio/engine";
import { scoreTiming } from "@/lib/audio/scheduler";
import { easiestShape, shapeMidi } from "@/lib/music/chords";
import { saveGuitarResult } from "./shared";

type Stroke = "D" | "U" | "-";
export const STRUM_PATTERNS: { id: string; name: string; beatsPerBar: number; slots: Stroke[] }[] = [
  { id: "downs", name: "All downstrokes (1 2 3 4)", beatsPerBar: 4, slots: ["D", "-", "D", "-", "D", "-", "D", "-"] },
  { id: "eighths", name: "Down-up eighths (1 & 2 & …)", beatsPerBar: 4, slots: ["D", "U", "D", "U", "D", "U", "D", "U"] },
  { id: "folk", name: "Folk pattern: D  DU  UDU", beatsPerBar: 4, slots: ["D", "-", "D", "U", "-", "U", "D", "U"] },
  { id: "waltz", name: "Waltz 3/4: D D D", beatsPerBar: 3, slots: ["D", "-", "D", "-", "D", "-"] },
];

const BARS = 4;
const COUNTS = ["1", "&", "2", "&", "3", "&", "4", "&"];

/** Expected stroke times (seconds) for one bar starting at `barStart`. Exported for tests. */
export function strokeTimes(slots: Stroke[], barStart: number, bpm: number): { time: number; stroke: Stroke; slot: number }[] {
  const half = 60 / bpm / 2;
  return slots.flatMap((s, i) => (s === "-" ? [] : [{ time: barStart + i * half, stroke: s, slot: i }]));
}

export function Strumming() {
  const tr = useT();
  const tx = useTx();
  const [patternId, setPatternId] = useState("downs");
  const [bpm, setBpm] = useState(60);
  const [chord, setChord] = useState("G");
  const [sound, setSound] = useState<"on" | "off">("on");
  const [phase, setPhase] = useState<"idle" | "count-in" | "playing" | "done">("idle");
  const [slot, setSlot] = useState(-1);
  const [result, setResult] = useState<(ReturnType<typeof scoreTiming> & { total: number }) | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const pattern = STRUM_PATTERNS.find((p) => p.id === patternId)!;
  const expected = useRef<number[]>([]);
  const taps = useRef<number[]>([]);
  const slotTimers = useRef<number[]>([]);
  const { ping } = usePracticeLog("Guitar exercise: strumming", { instrument: "guitar" });

  const finish = useCallback(() => {
    const r = scoreTiming(expected.current.map((t) => t * 1000), taps.current.map((t) => t * 1000), 160);
    setResult({ ...r, total: expected.current.length });
    setPhase("done");
    setSlot(-1);
    void saveGuitarResult({ exerciseId: `guitar-strum-${patternId}`, skill: "strumming-timing", input: "tap", correct: r.hitCount, total: expected.current.length, measured: true, details: `mean timing error ${Math.round(r.meanAbsMs ?? 0)} ms at ${bpm} BPM` });
  }, [bpm, patternId]);

  const metro = useMetronome({ bpm, beatsPerBar: pattern.beatsPerBar }, (e) => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (e.beatInBar === 0) {
      if (e.bar === 0) setPhase("count-in");
      else if (e.bar <= BARS) {
        setPhase("playing");
        expected.current.push(...strokeTimes(pattern.slots, e.audioTime, bpm).map((s) => s.time));
      } else {
        stopRef.current();
        finish();
        return;
      }
    }
    // Light up the slots of this beat.
    if (e.bar >= 1 && e.bar <= BARS) {
      const half = (60 / bpm / 2) * 1000;
      const first = e.beatInBar * 2;
      setSlot(first);
      slotTimers.current.push(window.setTimeout(() => setSlot(first + 1), half));
    }
  });

  useEffect(() => {
    stopRef.current = metro.stop;
  }, [metro.stop]);
  useEffect(() => () => slotTimers.current.forEach(clearTimeout), []);

  // Keep the metronome in sync with the chosen tempo/meter before starting.
  const { setBpm: setMetroBpm, setBeatsPerBar } = metro;
  useEffect(() => {
    setMetroBpm(bpm);
    setBeatsPerBar(pattern.beatsPerBar);
  }, [bpm, pattern.beatsPerBar, setMetroBpm, setBeatsPerBar]);

  const tap = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx || (phase !== "playing" && phase !== "count-in")) return;
    taps.current.push(ctx.currentTime);
    ping();
    if (sound === "on") {
      const s = easiestShape(chord);
      if (s) void strum(shapeMidi(s), "down", 0.012);
    }
  }, [phase, ping, sound, chord]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && (phase === "playing" || phase === "count-in")) {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, tap]);

  const start = async () => {
    expected.current = [];
    taps.current = [];
    setResult(null);
    await metro.start();
  };
  const stop = () => {
    metro.stop();
    setPhase("idle");
    setSlot(-1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{tr("ui.pattern")}</span>
          <Select aria-label={tr("ui.strumming_pattern")} value={patternId} onChange={(e) => setPatternId(e.target.value)} disabled={metro.running}>
            {STRUM_PATTERNS.map((p) => <option key={p.id} value={p.id}>{tx(p.name)}</option>)}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{tr("ui.tempo")}</span>
          <Select aria-label={tr("ui.tempo")} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} disabled={metro.running}>
            {[50, 60, 70, 80, 90, 100].map((b) => <option key={b} value={b}>{b} BPM</option>)}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{tr("ui.chord_sound_on_tap")}</span>
          <Select aria-label={tr("ui.chord")} value={chord} onChange={(e) => setChord(e.target.value)}>
            {["G", "C", "D", "Em", "Am"].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </label>
        <Segmented label={tr("ui.tap_sound")} size="sm" value={sound} onChange={setSound} options={[{ value: "on", label: tr("ui.sound_on") }, { value: "off", label: tr("ui.silent_i_ll_play_my_guitar") }]} />
      </div>

      <div className="flex gap-1.5" role="img" aria-label={`Pattern: ${pattern.slots.join(" ")}`}>
        {pattern.slots.map((s, i) => (
          <div key={i} className={cn("flex w-12 flex-col items-center rounded-xl border py-2 transition-colors", slot === i ? "border-accent bg-accent-soft" : "border-border bg-surface")}>
            <span className={cn("text-xl font-bold", s === "-" && "text-subtle")}>{s === "D" ? "↓" : s === "U" ? "↑" : "·"}</span>
            <span className="text-xs text-muted">{COUNTS[i]}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {metro.running ? (
          <Button variant="secondary" onClick={stop}><Square className="h-4 w-4" /> {tr("ui.stop")}</Button>
        ) : (
          <Button onClick={start}>{tr("ui.start_count_in", { n: BARS })}</Button>
        )}
        <Button
          size="lg"
          variant="outline"
          className="min-w-40"
          onPointerDown={(e) => { e.preventDefault(); tap(); }}
          disabled={!metro.running}
          aria-label={tr("ui.tap_on_each_strum_or_press_space")}
        >
          <Hand className="h-5 w-5" /> {tr("ui.tap_each_strum")}
        </Button>
        <span className="text-sm text-muted" aria-live="polite">{phase === "count-in" ? tr("ui.count_in_get_ready") : phase === "playing" ? tr("ui.strum_and_tap") : ""}</span>
      </div>
      <p className="text-xs text-muted">{tr("ui.strum_your_real_guitar_and_tap_the_button_or_spa")}</p>

      {result && (
        <Callout tone={result.accuracy >= 0.8 ? "success" : "warn"} title={tr("ui.strums_on_time", { hit: result.hitCount, total: result.total })}>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <SourceTag source="measured" />
            <Badge>{tr("ui.avg_error_ms", { ms: Math.round(result.meanAbsMs ?? 0) })}</Badge>
            <Badge tone="warn">{tr("ui.n_early", { n: result.early })}</Badge>
            <Badge tone="warn">{tr("ui.n_late", { n: result.late })}</Badge>
            <Badge tone="danger">{tr("ui.n_missed", { n: result.missed })}</Badge>
            {result.extra > 0 && <Badge>{tr("ui.n_extra_taps", { n: result.extra })}</Badge>}
          </div>
          <p className="mt-2 text-text">
            {result.missed > result.total / 3
              ? tr("ui.lots_of_missed_strums_slow_the_tempo_down_and_ke")
              : result.early > result.late
                ? tr("ui.you_tend_to_rush_ahead_of_the_click_relax_and_le")
                : result.late > result.early
                  ? tr("ui.you_re_a_little_behind_the_click_start_the_motio")
                  : tr("ui.nicely_steady_try_a_faster_tempo_or_the_next_pat")}
          </p>
        </Callout>
      )}
    </div>
  );
}
