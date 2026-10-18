"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ear, Hand, Play, RotateCcw, Timer } from "lucide-react";
import { useMidi } from "@/hooks/use-midi";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Slider, SourceTag, Switch, cn } from "@/components/ui";
import { ensureAudio, getAudioContext, scheduleClick } from "@/lib/audio/engine";
import { scoreTiming } from "@/lib/audio/scheduler";
import { exerciseRepo } from "@/lib/storage/repositories";
import { RHYTHM_PATTERNS, patternDuration, patternHitTimes, rhythmFeedback, type RhythmPattern } from "./logic/rhythm";

const LATENCY_KEY = "mm:rhythm-latency-ms";
function loadLatency(): number {
  try {
    return Number(localStorage.getItem(LATENCY_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function scheduleTone(ctx: AudioContext, time: number, freq = 520) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.45, time + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
  o.connect(g).connect(ctx.destination);
  o.start(time);
  o.stop(time + 0.16);
}

type Phase = "idle" | "demo" | "count-in" | "playing" | "done" | "calibrating";
type Score = ReturnType<typeof scoreTiming> & { startMs: number; total: number };

export function RhythmTrainer() {
  const [pattern, setPattern] = useState<RhythmPattern>(RHYTHM_PATTERNS[0]);
  const [bpm, setBpm] = useState(RHYTHM_PATTERNS[0].bpm);
  const [guide, setGuide] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState<Score | null>(null);
  const [latency, setLatency] = useState(0);
  const [tapFlash, setTapFlash] = useState(false);
  const run = useRef<{ start: number; expected: number[]; taps: number[]; end: number } | null>(null);
  const timers = useRef<number[]>([]);
  const calib = useRef<{ clicks: number[]; taps: number[] } | null>(null);
  const { ping } = usePracticeLog("Rhythm trainer");

  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
  useEffect(() => setLatency(loadLatency()), []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const choose = (p: RhythmPattern) => {
    setPattern(p);
    setBpm(p.bpm);
    setScore(null);
    setPhase("idle");
  };

  const demo = async () => {
    await ensureAudio();
    const ctx = getAudioContext()!;
    const t0 = ctx.currentTime + 0.1;
    const beat = 60 / bpm;
    for (let i = 0; i < pattern.bars * pattern.beatsPerBar; i++) scheduleClick(ctx, t0 + i * beat, i % pattern.beatsPerBar === 0);
    patternHitTimes(pattern, t0, bpm).forEach((t) => scheduleTone(ctx, t));
    setPhase("demo");
    later((patternDuration(pattern, bpm) + 0.3) * 1000, () => setPhase("idle"));
  };

  const start = async () => {
    await ensureAudio();
    const ctx = getAudioContext()!;
    const beat = 60 / bpm;
    const countIn = ctx.currentTime + 0.15;
    const start = countIn + pattern.beatsPerBar * beat;
    for (let i = 0; i < pattern.beatsPerBar; i++) scheduleClick(ctx, countIn + i * beat, i === 0);
    for (let i = 0; i < pattern.bars * pattern.beatsPerBar; i++) scheduleClick(ctx, start + i * beat, i % pattern.beatsPerBar === 0);
    const expected = patternHitTimes(pattern, start, bpm);
    if (guide) expected.forEach((t) => scheduleTone(ctx, t, 440));
    const end = start + patternDuration(pattern, bpm);
    run.current = { start, expected, taps: [], end };
    setScore(null);
    setPhase("count-in");
    later((start - ctx.currentTime) * 1000, () => setPhase("playing"));
    later((end - ctx.currentTime + 0.4) * 1000, finish);
  };

  const finish = () => {
    const r = run.current;
    if (!r) return;
    const s = { ...scoreTiming(r.expected.map((t) => t * 1000), r.taps.map((t) => t * 1000), Math.min(220, (60000 / bpm) * 0.45)), startMs: r.start * 1000, total: r.expected.length };
    setScore(s);
    setPhase("done");
    ping();
    void exerciseRepo.add({
      instrument: "theory",
      exerciseId: `rhythm:${pattern.id}`,
      skill: "rhythm",
      input: "tap",
      correct: s.hitCount,
      total: r.expected.length,
      accuracy: s.accuracy,
      timingErrorMs: s.meanAbsMs ?? undefined,
      measured: true,
      details: `${pattern.name} at ${bpm} BPM`,
    });
  };

  const tap = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime - latency / 1000;
    setTapFlash(true);
    window.setTimeout(() => setTapFlash(false), 90);
    if (calib.current) {
      calib.current.taps.push(t + latency / 1000);
      return;
    }
    const r = run.current;
    if (!r || t > r.end + 0.3) return;
    r.taps.push(t);
  }, [latency]);

  useMidi((e) => e.type === "on" && tap());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const el = e.target as HTMLElement;
      // Space on a focused button would normally "click" it; we take Space over as the tap key.
      if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) return;
      e.preventDefault();
      tap();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tap]);

  const calibrate = async () => {
    await ensureAudio();
    const ctx = getAudioContext()!;
    const beat = 60 / 90;
    const t0 = ctx.currentTime + 0.5;
    const clicks = Array.from({ length: 10 }, (_, i) => t0 + i * beat);
    clicks.forEach((t, i) => scheduleClick(ctx, t, i === 0));
    calib.current = { clicks, taps: [] };
    setPhase("calibrating");
    later((clicks[9] - ctx.currentTime + 0.6) * 1000, () => {
      const c = calib.current!;
      calib.current = null;
      // Ignore the first 2 clicks (reaction), match each later click to the nearest tap.
      const offs = c.clicks.slice(2).map((ck) => {
        const near = c.taps.reduce((b, t) => (Math.abs(t - ck) < Math.abs(b - ck) ? t : b), Infinity);
        return Math.abs(near - ck) < 0.25 ? (near - ck) * 1000 : null;
      }).filter((x): x is number => x !== null).sort((a, b) => a - b);
      if (offs.length >= 4) {
        const med = Math.round(offs[Math.floor(offs.length / 2)]);
        setLatency(med);
        try { localStorage.setItem(LATENCY_KEY, String(med)); } catch { /* ignore */ }
      }
      setPhase("idle");
    });
  };

  const busy = phase === "count-in" || phase === "playing" || phase === "calibrating" || phase === "demo";

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Card className="h-fit">
        <CardHeader title="Patterns" description="Easiest first." />
        <CardBody className="space-y-1.5">
          {RHYTHM_PATTERNS.map((p) => (
            <button key={p.id} type="button" onClick={() => choose(p)} disabled={busy} aria-pressed={p.id === pattern.id} className={cn("flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60", p.id === pattern.id ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2")}>
              <span className="font-medium">{p.name}</span>
              <Badge>L{p.level}</Badge>
            </button>
          ))}
        </CardBody>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title={pattern.name} description={pattern.description} action={<Badge tone="theory">{pattern.beatsPerBar === 3 && pattern.id === "dadra" ? "6/8" : `${pattern.beatsPerBar}/4`}</Badge>} />
          <CardBody className="space-y-5">
            <PatternGrid pattern={pattern} />
            <p className="text-sm text-muted">Count: <span className="font-mono text-text">{pattern.count}</span></p>
            <Slider label="Tempo" value={bpm} min={40} max={160} step={5} onChange={setBpm} format={(v) => `${v} BPM`} />
            <Switch label="Play the rhythm as a guide while I tap" description="Turn off for a real test: you'll hear only the clicks." checked={guide} onChange={setGuide} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void demo()} disabled={busy}><Ear className="h-4 w-4" /> Hear the pattern</Button>
              <Button onClick={() => void start()} disabled={busy} data-testid="rhythm-start"><Play className="h-4 w-4" /> Start (1-bar count-in)</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm font-medium text-muted" aria-live="polite">
              {phase === "count-in" ? "Get ready… count along" : phase === "playing" ? "Tap now!" : phase === "calibrating" ? "Tap exactly with each click" : phase === "demo" ? "Listen…" : "Tap with the button, the Space bar, or any MIDI key"}
            </p>
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); tap(); }}
              className={cn("flex h-36 w-36 items-center justify-center rounded-full border-4 text-lg font-semibold transition-all duration-75 select-none touch-none", tapFlash ? "scale-95 border-accent bg-accent text-accent-fg" : phase === "playing" || phase === "calibrating" ? "border-accent bg-accent-soft text-accent" : "border-border-strong bg-surface-2 text-muted")}
              aria-label="Tap"
              data-testid="rhythm-tap"
            >
              <Hand className="mr-2 h-6 w-6" /> TAP
            </button>
          </CardBody>
        </Card>

        {score && (
          <Card aria-live="polite">
            <CardHeader title="Timing result" action={<SourceTag source="measured" />} />
            <CardBody className="space-y-4">
              <p>{rhythmFeedback(score, score.total)}</p>
              <Timeline score={score} start={score.startMs} beatMs={60000 / bpm} beats={pattern.bars * pattern.beatsPerBar} />
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge tone="success">{score.hitCount} hit</Badge>
                <Badge tone="warn">{score.early} early</Badge>
                <Badge tone="piano">{score.late} late</Badge>
                <Badge tone="danger">{score.missed} missed</Badge>
                {score.extra > 0 && <Badge>{score.extra} extra</Badge>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void start()}><RotateCcw className="h-4 w-4" /> Try again</Button>
                {score.accuracy >= 0.9 && (score.meanAbsMs ?? 999) < 70 && RHYTHM_PATTERNS.indexOf(pattern) < RHYTHM_PATTERNS.length - 1 && (
                  <Button onClick={() => choose(RHYTHM_PATTERNS[RHYTHM_PATTERNS.indexOf(pattern) + 1])}>Next pattern</Button>
                )}
              </div>
              <p className="text-xs text-muted">Timing is measured from your taps against the audio clock{latency ? `, corrected by your ${latency} ms calibration` : ""}. Within ±40 ms counts as on time.</p>
            </CardBody>
          </Card>
        )}

        <Callout tone="neutral" icon={<Timer className="h-4 w-4" />} title="Tap latency calibration">
          <p>Bluetooth headphones and some screens add delay. Calibrate once: tap along with 10 clicks and we&apos;ll subtract your typical delay. Current: <strong>{latency} ms</strong>.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void calibrate()} disabled={busy}>Calibrate</Button>
            {latency !== 0 && <Button size="sm" variant="ghost" onClick={() => { setLatency(0); try { localStorage.removeItem(LATENCY_KEY); } catch { /* ignore */ } }}>Reset</Button>}
          </div>
        </Callout>
      </div>
    </div>
  );
}

function PatternGrid({ pattern }: { pattern: RhythmPattern }) {
  const slots = pattern.beatsPerBar * 2;
  return (
    <div className="flex gap-1" aria-label={`Pattern: hits on beats ${pattern.hits.map((h) => h + 1).join(", ")}`}>
      {Array.from({ length: slots }, (_, i) => {
        const hit = pattern.hits.includes(i / 2);
        return (
          <div key={i} className={cn("flex h-12 flex-1 items-end justify-center rounded-lg pb-1 text-[11px] font-medium", hit ? "bg-accent text-accent-fg" : "bg-surface-2 text-subtle", i % 2 === 0 && "ring-1 ring-inset ring-border-strong")}>
            {i % 2 === 0 ? i / 2 + 1 : "&"}
          </div>
        );
      })}
    </div>
  );
}

function Timeline({ score, start, beatMs, beats }: { score: Score; start: number; beatMs: number; beats: number }) {
  const total = beats * beatMs;
  const pct = (t: number) => `${((t - start) / total) * 100}%`;
  return (
    <div className="relative h-20 rounded-xl bg-surface-2" role="img" aria-label="Timeline of expected notes and your taps">
      {Array.from({ length: beats + 1 }, (_, i) => (
        <div key={i} className="absolute inset-y-0 w-px bg-border-strong" style={{ left: `${(i / beats) * 100}%` }} />
      ))}
      {score.hits.map((h, i) => (
        <div key={i}>
          <div className="absolute top-2 h-6 w-1.5 -translate-x-1/2 rounded bg-text/70" style={{ left: pct(h.expected) }} title="expected" />
          {h.tap !== null && (
            <div
              className={cn("absolute bottom-2 h-6 w-2 -translate-x-1/2 rounded", Math.abs(h.offsetMs!) <= 40 ? "bg-success" : h.offsetMs! < 0 ? "bg-warn" : "bg-piano")}
              style={{ left: pct(h.tap) }}
              title={`${h.offsetMs! > 0 ? "+" : ""}${Math.round(h.offsetMs!)} ms`}
            />
          )}
          {h.tap === null && <div className="absolute bottom-3 -translate-x-1/2 text-xs font-bold text-danger" style={{ left: pct(h.expected) }}>×</div>}
        </div>
      ))}
      <span className="absolute left-2 top-1 text-[10px] text-muted">expected</span>
      <span className="absolute bottom-1 left-2 text-[10px] text-muted">you</span>
    </div>
  );
}
