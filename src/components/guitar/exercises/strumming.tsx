"use client";

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
          <span className="block font-medium">Pattern</span>
          <Select aria-label="Strumming pattern" value={patternId} onChange={(e) => setPatternId(e.target.value)} disabled={metro.running}>
            {STRUM_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Tempo</span>
          <Select aria-label="Tempo" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} disabled={metro.running}>
            {[50, 60, 70, 80, 90, 100].map((b) => <option key={b} value={b}>{b} BPM</option>)}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Chord sound on tap</span>
          <Select aria-label="Chord" value={chord} onChange={(e) => setChord(e.target.value)}>
            {["G", "C", "D", "Em", "Am"].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </label>
        <Segmented label="Tap sound" size="sm" value={sound} onChange={setSound} options={[{ value: "on", label: "Sound on" }, { value: "off", label: "Silent (I'll play my guitar)" }]} />
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
          <Button variant="secondary" onClick={stop}><Square className="h-4 w-4" /> Stop</Button>
        ) : (
          <Button onClick={start}>Start (1 bar count-in, then {BARS} bars)</Button>
        )}
        <Button
          size="lg"
          variant="outline"
          className="min-w-40"
          onPointerDown={(e) => { e.preventDefault(); tap(); }}
          disabled={!metro.running}
          aria-label="Tap on each strum (or press Space)"
        >
          <Hand className="h-5 w-5" /> Tap each strum
        </Button>
        <span className="text-sm text-muted" aria-live="polite">{phase === "count-in" ? "Count-in… get ready" : phase === "playing" ? "Strum and tap!" : ""}</span>
      </div>
      <p className="text-xs text-muted">Strum your real guitar and tap the button (or Space) at the same moment — or just tap along to learn the feel. We measure the timing of your taps, not the guitar sound.</p>

      {result && (
        <Callout tone={result.accuracy >= 0.8 ? "success" : "warn"} title={`${result.hitCount} of ${result.total} strums on time`}>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <SourceTag source="measured" />
            <Badge>avg error {Math.round(result.meanAbsMs ?? 0)} ms</Badge>
            <Badge tone="warn">{result.early} early</Badge>
            <Badge tone="warn">{result.late} late</Badge>
            <Badge tone="danger">{result.missed} missed</Badge>
            {result.extra > 0 && <Badge>{result.extra} extra taps</Badge>}
          </div>
          <p className="mt-2 text-text">
            {result.missed > result.total / 3
              ? "Lots of missed strums — slow the tempo down and keep your hand moving down and up even on the silent slots."
              : result.early > result.late
                ? "You tend to rush ahead of the click. Relax and let the beat come to you."
                : result.late > result.early
                  ? "You're a little behind the click. Start the motion slightly earlier."
                  : "Nicely steady! Try a faster tempo or the next pattern."}
          </p>
        </Callout>
      )}
    </div>
  );
}
