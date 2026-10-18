"use client";
import { useT, useTx, useTm } from "@/lib/i18n";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ear, Hand, Play, RotateCcw, Timer } from "lucide-react";
import { useMidi } from "@/hooks/use-midi";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Slider, SourceTag, Switch, cn } from "@/components/ui";
import { ensureAudio, getAudioContext, scheduleClick } from "@/lib/audio/engine";
import { scoreTiming } from "@/lib/audio/scheduler";
import { exerciseRepo } from "@/lib/storage/repositories";
import { ALL_RHYTHM_PATTERNS as RHYTHM_PATTERNS, patternDuration, patternHitTimes, rhythmFeedbackMessages, type RhythmPattern } from "./logic/rhythm";
import { TAALS, bolVoice } from "@/lib/music/taal";
import { TaalVisual } from "./taal-visual";

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

/**
 * Tabla-style practice click for a bol: a short pitched "ring" for the treble drum and a falling
 * low thump for the bass drum. A simple synthesised approximation, not a recording.
 */
function scheduleBol(ctx: AudioContext, time: number, bol: string, sam: boolean) {
  const v = bolVoice(bol);
  const peak = sam ? 0.6 : 0.4;
  if (v.high) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = v.muted ? 620 : 880;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(v.muted ? peak * 0.5 : peak, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + (v.muted ? 0.06 : 0.22));
    o.connect(g).connect(ctx.destination);
    o.start(time);
    o.stop(time + 0.25);
  }
  if (v.low) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, time);
    o.frequency.exponentialRampToValueAtTime(70, time + 0.25);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    o.connect(g).connect(ctx.destination);
    o.start(time);
    o.stop(time + 0.32);
  }
  if (!v.high && !v.low) scheduleClick(ctx, time, sam);
}

type Phase = "idle" | "demo" | "count-in" | "playing" | "done" | "calibrating";
type Score = ReturnType<typeof scoreTiming> & { startMs: number; total: number };

export function RhythmTrainer() {
  const tr = useT();
  const tm = useTm();
  const tx = useTx();
  const [pattern, setPattern] = useState<RhythmPattern>(RHYTHM_PATTERNS[0]);
  const [bpm, setBpm] = useState(RHYTHM_PATTERNS[0].bpm);
  const [guide, setGuide] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState<Score | null>(null);
  const [latency, setLatency] = useState(0);
  const [tapFlash, setTapFlash] = useState(false);
  const [tabla, setTabla] = useState(true);
  const [matra, setMatra] = useState(-1);
  const run = useRef<{ start: number; expected: number[]; taps: number[]; end: number } | null>(null);
  const timers = useRef<number[]>([]);
  const calib = useRef<{ clicks: number[]; taps: number[] } | null>(null);
  const { ping } = usePracticeLog("Rhythm trainer");

  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
  useEffect(() => setLatency(loadLatency()), []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const taal = pattern.taal ? TAALS[pattern.taal] : null;

  /** Beat clicks for one bar starting at `t0`: tabla bols for taal patterns, metronome otherwise. */
  const scheduleBeats = (ctx: AudioContext, t0: number, beats: number, highlight: boolean) => {
    const beat = 60 / bpm;
    for (let i = 0; i < beats; i++) {
      const t = t0 + i * beat;
      const inBar = i % pattern.beatsPerBar;
      if (taal && tabla) scheduleBol(ctx, t, taal.bols[inBar], inBar === 0);
      else scheduleClick(ctx, t, inBar === 0);
      if (highlight) later(Math.max(0, (t - ctx.currentTime) * 1000), () => setMatra(inBar));
    }
    if (highlight) later(Math.max(0, (t0 + beats * beat - ctx.currentTime) * 1000), () => setMatra(-1));
  };

  const choose = (p: RhythmPattern) => {
    setPattern(p);
    setBpm(p.bpm);
    setMatra(-1);
    setScore(null);
    setPhase("idle");
  };

  const demo = async () => {
    await ensureAudio();
    const ctx = getAudioContext()!;
    const t0 = ctx.currentTime + 0.1;
    scheduleBeats(ctx, t0, pattern.bars * pattern.beatsPerBar, true);
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
    scheduleBeats(ctx, start, pattern.bars * pattern.beatsPerBar, true);
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
        <CardHeader title={tr("ui.patterns")} description={tr("ui.easiest_first")} />
        <CardBody className="space-y-1.5">
          {(["western", "taal"] as const).map((group) => (
            <div key={group} className="space-y-1.5">
              <p className={cn("px-1 text-xs font-semibold uppercase tracking-wider text-subtle", group === "taal" && "pt-3")}>{group === "taal" ? tr("ui.indian_taal_bollywood_feels") : tr("ui.beats_strums")}</p>
              {RHYTHM_PATTERNS.filter((p) => (p.group ?? "western") === group).map((p) => (
                <button key={p.id} type="button" onClick={() => choose(p)} disabled={busy} aria-pressed={p.id === pattern.id} data-testid={`pattern-${p.id}`} className={cn("flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60", p.id === pattern.id ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2")}>
                  <span className="font-medium">{tx(p.name)}</span>
                  <Badge>L{p.level}</Badge>
                </button>
              ))}
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title={tx(pattern.name)} description={tx(pattern.description)} action={<Badge tone="theory">{taal ? tr("ui.n_matras", { name: taal.name, n: taal.matras }) : `${pattern.beatsPerBar}/4`}</Badge>} />
          <CardBody className="space-y-5">
            {taal ? (
              <div className="space-y-2">
                <TaalVisual taal={taal} current={matra} hits={pattern.hits} strokes={pattern.hits.length < taal.matras ? pattern.count.split(" ") : undefined} />
                <p className="text-xs text-muted">
                  <span lang="hi">{taal.hindi}</span> · {taal.vibhag.join(" + ")} · <span className="font-semibold text-accent">X</span> {tr("ui.sam_strongest")} · <span className="font-semibold text-piano">0</span> {tr("ui.khali_lighter")} · {tx(taal.western)}
                </p>
              </div>
            ) : (
              <PatternGrid pattern={pattern} />
            )}
            <p className="text-sm text-muted">{taal ? tr("ui.theka_strokes") : tr("ui.count")}: <span className="font-mono text-text">{pattern.count}</span></p>
            <Slider label={tr("ui.tempo")} value={bpm} min={40} max={160} step={5} onChange={setBpm} format={(v) => `${v} BPM`} />
            <Switch label={tr("ui.play_the_rhythm_as_a_guide_while_i_tap")} description={tr("ui.turn_off_for_a_real_test_you_ll_hear_only_the_cl")} checked={guide} onChange={setGuide} />
            {taal && <Switch label={tr("ui.tabla_style_beat")} description={tr("ui.bass_and_treble_clicks_follow_the_bols_a_synthes")} checked={tabla} onChange={setTabla} />}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void demo()} disabled={busy}><Ear className="h-4 w-4" /> {tr("ui.hear_the_pattern")}</Button>
              <Button onClick={() => void start()} disabled={busy} data-testid="rhythm-start"><Play className="h-4 w-4" /> {tr("ui.start_1_bar_count_in")}</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm font-medium text-muted" aria-live="polite">
              {phase === "count-in" ? tr("ui.get_ready_count_along") : phase === "playing" ? tr("ui.tap_now") : phase === "calibrating" ? tr("ui.tap_exactly_with_each_click") : phase === "demo" ? "Listen…" : tr("ui.tap_with_the_button_the_space_bar_or_any_midi_ke")}
            </p>
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); tap(); }}
              className={cn("flex h-40 w-40 items-center justify-center sm:h-36 sm:w-36 rounded-full border-4 text-lg font-semibold transition-all duration-75 select-none touch-none", tapFlash ? "scale-95 border-accent bg-accent text-accent-fg" : phase === "playing" || phase === "calibrating" ? "border-accent bg-accent-soft text-accent" : "border-border-strong bg-surface-2 text-muted")}
              aria-label={tr("ui.tap_2")}
              data-testid="rhythm-tap"
            >
              <Hand className="mr-2 h-6 w-6" /> {tr("ui.tap")}
            </button>
          </CardBody>
        </Card>

        {score && (
          <Card aria-live="polite">
            <CardHeader title={tr("ui.timing_result")} action={<SourceTag source="measured" />} />
            <CardBody className="space-y-4">
              <p>{rhythmFeedbackMessages(score, score.total).map((m) => tm(m)).join(" ")}</p>
              <Timeline score={score} start={score.startMs} beatMs={60000 / bpm} beats={pattern.bars * pattern.beatsPerBar} />
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge tone="success">{score.hitCount} hit</Badge>
                <Badge tone="warn">{score.early} early</Badge>
                <Badge tone="piano">{score.late} late</Badge>
                <Badge tone="danger">{score.missed} missed</Badge>
                {score.extra > 0 && <Badge>{score.extra} extra</Badge>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void start()}><RotateCcw className="h-4 w-4" /> {tr("ui.try_again")}</Button>
                {score.accuracy >= 0.9 && (score.meanAbsMs ?? 999) < 70 && RHYTHM_PATTERNS.indexOf(pattern) < RHYTHM_PATTERNS.length - 1 && (
                  <Button onClick={() => choose(RHYTHM_PATTERNS[RHYTHM_PATTERNS.indexOf(pattern) + 1])}>{tr("ui.next_pattern")}</Button>
                )}
              </div>
              <p className="text-xs text-muted">{latency ? tr("ui.timing_measured_lat", { ms: latency }) : tr("ui.timing_measured")}</p>
            </CardBody>
          </Card>
        )}

        <Callout tone="neutral" icon={<Timer className="h-4 w-4" />} title={tr("ui.tap_latency_calibration")}>
          <p>{tr("ui.latency_explain")} <strong>{latency} ms</strong>.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void calibrate()} disabled={busy}>{tr("ui.calibrate")}</Button>
            {latency !== 0 && <Button size="sm" variant="ghost" onClick={() => { setLatency(0); try { localStorage.removeItem(LATENCY_KEY); } catch { /* ignore */ } }}>{tr("ui.reset")}</Button>}
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
  const tr = useT();
  const total = beats * beatMs;
  const pct = (t: number) => `${((t - start) / total) * 100}%`;
  return (
    <div className="relative h-20 rounded-xl bg-surface-2" role="img" aria-label={tr("ui.timeline_of_expected_notes_and_your_taps")}>
      {Array.from({ length: beats + 1 }, (_, i) => (
        <div key={i} className="absolute inset-y-0 w-px bg-border-strong" style={{ left: `${(i / beats) * 100}%` }} />
      ))}
      {score.hits.map((h, i) => (
        <div key={i}>
          <div className="absolute top-2 h-6 w-1.5 -translate-x-1/2 rounded bg-text/70" style={{ left: pct(h.expected) }} title={tr("ui.expected")} />
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
      <span className="absolute left-2 top-1 text-[10px] text-muted">{tr("ui.expected")}</span>
      <span className="absolute bottom-1 left-2 text-[10px] text-muted">{tr("ui.you")}</span>
    </div>
  );
}
