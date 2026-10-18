"use client";
import { useT, useTx, useTm } from "@/lib/i18n";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CheckCircle2, Hand, Lock, Mic, Pause, Play, RotateCcw, Sparkles, Timer, Trophy } from "lucide-react";
import { toast } from "sonner";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { MicButton } from "@/components/instruments/mic-button";
import { MetronomeWidget } from "@/components/practice/metronome-widget";
import { Badge, Button, Callout, Card, CardBody, CardHeader, EmptyState, ProgressBar, Segmented, Select, SourceTag, cn } from "@/components/ui";
import { useData } from "@/hooks/use-data";
import { useMic } from "@/hooks/use-mic";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { strum } from "@/lib/audio/engine";
import { easiestShape, OPEN_SHAPES, shapeMidi } from "@/lib/music/chords";
import { drillRepo, goalsRepo } from "@/lib/storage/repositories";
import { DEFAULT_GOALS, type ChordDrillResult } from "@/lib/storage/schemas";
import {
  audioFrameTransition,
  createTimer,
  createTransitions,
  currentChord,
  DRILL_PAIRS,
  drillSuggestions,
  elapsedMs,
  formatClock,
  isPairUnlocked,
  manualConfirmTransition,
  pairKey,
  pauseTimer,
  personalBests,
  recommendPair,
  remainingMs,
  restartTimer,
  resumeTimer,
  selfReportTransition,
  startTimer,
  targetChord,
  tickTimer,
  TIER_NAMES,
  unlockedTiers,
  weeklyStats,
  type AudioOptions,
  type DrillTimer,
  type TransitionState,
} from "./drill-logic";

type Mode = "self" | "audio";
type Length = "timed" | "untimed";
type Difficulty = "relaxed" | "standard" | "strict";

const DIFFICULTY: Record<Difficulty, { label: string; audio: AudioOptions; bpm: number; hint: string }> = {
  relaxed: { label: "Relaxed", audio: { threshold: 0.35, stableNeeded: 3 }, bpm: 50, hint: "Gentle detection, slow metronome suggestion." },
  standard: { label: "Standard", audio: { threshold: 0.45, stableNeeded: 4 }, bpm: 70, hint: "Balanced detection." },
  strict: { label: "Strict", audio: { threshold: 0.6, stableNeeded: 6 }, bpm: 90, hint: "Only very clear, steady chords count." },
};

/** Chords available for custom pairs: everything in the verified open-shape library (plus easy F). */
const CUSTOM_CHORDS = Array.from(new Set(OPEN_SHAPES.filter((s) => s.kind !== "power").map((s) => s.chord)));

export function ChordDrill() {
  const tr = useT();
  const tm = useTm();
  const tx = useTx();
  const drills = useData(() => drillRepo.list(), ["chordDrills"], [] as ChordDrillResult[]);
  const goals = useData(() => goalsRepo.get(), ["goals"], DEFAULT_GOALS);
  const bests = useMemo(() => personalBests(drills.data), [drills.data]);
  const tierUnlocked = unlockedTiers(bests);

  const [pair, setPair] = useState<[string, string]>(["Em", "Am"]);
  const [mode, setMode] = useState<Mode>("self");
  const [length, setLength] = useState<Length>("timed");
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [practised, setPractised] = useState<[boolean, boolean]>([false, false]);
  const [timer, setTimer] = useState<DrillTimer>(() => createTimer(60_000));
  const [now, setNow] = useState(0);
  const [trans, setTrans] = useState<TransitionState>(() => createTransitions(["Em", "Am"]));
  const [finished, setFinished] = useState<{ result: ChordDrillResult; previousBest?: number; ambiguous: number } | null>(null);
  const transRef = useRef(trans);
  const runningRef = useRef(false);
  const raf = useRef(0);
  const { ping } = usePracticeLog("Chord change drill", { instrument: "guitar" });

  const running = timer.status === "running";
  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  const setTransBoth = useCallback((t: TransitionState) => {
    transRef.current = t;
    setTrans(t);
  }, []);

  const mic = useMic({
    mode: "chroma",
    onChroma: (f) => {
      if (!runningRef.current) return;
      const r = audioFrameTransition(transRef.current, { best: f.best?.symbol ?? null, activePcs: f.activePcs, confidence: f.confidence }, DIFFICULTY[difficulty].audio);
      transRef.current = r.state;
      if (r.counted) {
        setTrans(r.state);
        ping();
      }
    },
  });

  // Choose pair → reset everything.
  const choosePair = (p: [string, string]) => {
    if (running) return;
    setPair(p);
    setPractised([false, false]);
    setFinished(null);
    setTimer(createTimer(60_000));
    setTransBoth(createTransitions(p));
  };

  // Animation-frame loop while running; recomputes remaining time from timestamps (no drift).
  useEffect(() => {
    if (!running) return;
    const loop = () => {
      const t = performance.now();
      setNow(t);
      setTimer((prev) => {
        if (length === "untimed") return prev;
        const next = tickTimer(prev, t);
        return next;
      });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [running, length]);

  const save = useCallback(
    async (durationSec: number) => {
      const t = transRef.current;
      const previousBest = bests.get(pairKey(pair));
      const ambiguous = t.ambiguousFrames;
      const result = await drillRepo.add({
        pair,
        durationSec,
        transitions: t.count,
        mode,
        confirmedByAudio: mode === "audio" ? t.byAudio : undefined,
        confirmedManually: mode === "audio" ? t.manual : undefined,
        cleanRate: mode === "audio" && t.count > 0 ? t.byAudio / t.count : undefined,
        untimed: length === "untimed" || undefined,
      });
      setFinished({ result, previousBest: length === "untimed" ? undefined : previousBest, ambiguous });
      if (length === "timed" && (previousBest === undefined || t.count > previousBest) && t.count > 0) toast.success(tr("ui.new_pb_pair", { pair: pair.join(" ↔ "), n: t.count }));
    },
    [bests, pair, mode, length, tr],
  );

  // Timer reached zero → finish once.
  const savedFor = useRef<DrillTimer | null>(null);
  useEffect(() => {
    if (timer.status === "finished" && savedFor.current !== timer) {
      savedFor.current = timer;
      if (mode === "audio") mic.stop();
      void save(60);
    }
  }, [timer, save, mode, mic]);

  const start = () => {
    setFinished(null);
    setTransBoth(createTransitions(pair));
    const t = performance.now();
    setNow(t);
    setTimer((prev) => startTimer(restartTimer(prev), t));
    ping();
  };
  const pause = () => setTimer((prev) => pauseTimer(prev, performance.now()));
  const resume = () => {
    const t = performance.now();
    setNow(t);
    setTimer((prev) => resumeTimer(prev, t));
  };
  const restart = () => {
    setTimer((prev) => restartTimer(prev));
    setTransBoth(createTransitions(pair));
    setFinished(null);
  };
  const finishUntimed = () => {
    const secs = Math.round(elapsedMs(timer, performance.now()) / 1000);
    setTimer((prev) => ({ ...pauseTimer(prev, performance.now()), status: "finished" }));
    savedFor.current = null; // handled here, not by effect
    void save(secs);
  };

  const countChange = useCallback(() => {
    if (!runningRef.current) return;
    ping();
    setTransBoth(mode === "self" ? selfReportTransition(transRef.current) : manualConfirmTransition(transRef.current));
    const s = easiestShape(targetChord(transRef.current) === pair[0] ? pair[1] : pair[0]);
    if (s && mode === "self") void strum(shapeMidi(s), "down", 0.01);
  }, [mode, pair, ping, setTransBoth]);

  // Space bar counts a change in self-reported mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !runningRef.current || mode !== "self") return;
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(el.tagName)) return;
      e.preventDefault();
      countChange();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [countChange, mode]);

  const remaining = length === "timed" ? remainingMs(timer, running ? now : 0) : 0;
  const elapsed = elapsedMs({ ...timer, durationMs: Number.MAX_SAFE_INTEGER }, running ? now : 0);
  const pairHistory = drills.data.filter((d) => pairKey(d.pair) === pairKey(pair));
  const timedHistory = pairHistory.filter((d) => !d.untimed).slice(0, 10).reverse();
  const week = weeklyStats(drills.data);
  const rec = recommendPair(bests, finished ? pair : undefined);
  const unlocked = isPairUnlocked(pair, bests);
  const best = bests.get(pairKey(pair));
  const target = targetChord(trans);
  const holding = currentChord(trans);

  return (
    <div className="space-y-6">
      {/* Pair selection */}
      <Card>
        <CardHeader icon={<Hand className="h-5 w-5" />} title={tr("ui.1_choose_a_chord_pair")} description={tr("ui.start_with_easy_pairs_harder_pairs_unlock_as_you")} />
        <CardBody className="space-y-4">
          {DRILL_PAIRS.reduce<number[]>((tiers, p) => (tiers.includes(p.tier) ? tiers : [...tiers, p.tier]), []).map((tier) => (
            <div key={tier}>
              <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {tx(TIER_NAMES[tier])} {tier > tierUnlocked && <Badge><Lock className="h-3 w-3" /> {tr("ui.recommended_later")}</Badge>}
              </p>
              <div className="flex flex-wrap gap-2">
                {DRILL_PAIRS.filter((p) => p.tier === tier).map((p) => {
                  const active = pairKey(p.pair) === pairKey(pair);
                  const pb = bests.get(pairKey(p.pair));
                  return (
                    <button
                      key={pairKey(p.pair)}
                      type="button"
                      disabled={running}
                      onClick={() => choosePair(p.pair)}
                      aria-pressed={active}
                      className={cn("rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50", active ? "border-guitar bg-guitar-soft text-guitar" : "border-border hover:bg-surface-2", tier > tierUnlocked && !active && "opacity-70")}
                    >
                      {p.pair[0]} ↔ {p.pair[1]}
                      {pb !== undefined && <span className="ml-1.5 text-xs text-muted">best {pb}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <span className="text-sm font-medium">{tr("ui.or_any_two_chords")}</span>
            {[0, 1].map((i) => (
              <Select key={i} aria-label={`Custom chord ${i + 1}`} disabled={running} value={pair[i]} onChange={(e) => {
                const p: [string, string] = i === 0 ? [e.target.value, pair[1]] : [pair[0], e.target.value];
                if (p[0] !== p[1]) choosePair(p);
              }}>
                {Array.from(new Set([...CUSTOM_CHORDS, pair[i]])).map((c) => <option key={c}>{c}</option>)}
              </Select>
            ))}
          </div>
          {!unlocked && <Callout tone="warn" title={tr("ui.this_pair_is_usually_tackled_later")}>{tr("ui.free_practice_fine", { n: 30 })}</Callout>}
        </CardBody>
      </Card>

      {/* Learn the shapes */}
      <Card>
        <CardHeader icon={<Sparkles className="h-5 w-5" />} title={tr("ui.2_learn_and_practise_each_chord_on_its_own")} description={tr("ui.place_your_fingers_strum_once_and_check_every_st")} />
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            {pair.map((c, i) => {
              const s = easiestShape(c);
              const isTarget = running && c === target;
              return (
                <div key={c + i} className={cn("flex gap-4 rounded-2xl border p-3 transition-colors", isTarget ? "border-accent bg-accent-soft/40" : "border-border")}>
                  <ChordDiagram chord={c} size="lg" highlight={isTarget} />
                  <div className="min-w-0 flex-1 space-y-2 text-sm">
                    {s?.tips ? <ul className="list-disc space-y-1 pl-4 text-muted">{s.tips.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="text-muted">{tr("ui.press_just_behind_the_frets_with_your_fingertips")}</p>}
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="accent-[var(--accent)]" checked={practised[i]} onChange={(e) => setPractised((p) => (i === 0 ? [e.target.checked, p[1]] : [p[0], e.target.checked]))} />
                      {tr("ui.i_can_play_cleanly", { chord: c })} <SourceTag source="self-reported" />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-muted">
            <strong className="text-text">{tr("ui.tip")}</strong> {tr("ui.anchor_tip", { a: pair[0], b: pair[1] })}
          </p>
        </CardBody>
      </Card>

      {/* Drill */}
      <Card>
        <CardHeader icon={<Timer className="h-5 w-5" />} title={tr("ui.3_the_drill")} description={tr("ui.switch_back_and_forth_between_the_two_chords_cou")} />
        <CardBody className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <Segmented<Mode> label={tr("ui.scoring_mode")} value={mode} onChange={(m) => !running && setMode(m)} options={[
              { value: "self", label: tr("ui.self_reported"), icon: <Hand className="h-4 w-4" /> },
              { value: "audio", label: tr("ui.audio_assisted"), icon: <Mic className="h-4 w-4" /> },
            ]} />
            <Segmented<Length> label={tr("ui.length")} value={length} onChange={(l) => { if (!running) { setLength(l); restart(); } }} options={[
              { value: "timed", label: tr("ui.60_seconds") },
              { value: "untimed", label: tr("ui.untimed_slow") },
            ]} />
            <Segmented<Difficulty> label={tr("ui.difficulty")} value={difficulty} onChange={(d) => !running && setDifficulty(d)} options={(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => ({ value: d, label: tx(DIFFICULTY[d].label) }))} />
          </div>
          <p className="text-xs text-muted">{tx(DIFFICULTY[difficulty].hint)} {mode === "self" ? tr("ui.tap_the_button_or_press_space_after_each_complet") : tr("ui.mic_listens_next_chord")}</p>

          {(!practised[0] || !practised[1]) && timer.status === "idle" && (
            <Callout tone="info" title={tr("ui.warm_up_first")}>{tr("ui.tick_both_chords_above_once_you_can_play_them_cl")}</Callout>
          )}

          {mode === "audio" && (
            <div className="rounded-xl border border-border p-3">
              <MicButton status={mic.status} error={mic.error} onStart={mic.start} onStop={mic.stop} label={tr("ui.turn_on_the_microphone")} />
              {mic.listening && (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm" aria-live="polite">
                  <span className="text-muted">{tr("ui.hearing")}</span>
                  <span className="font-semibold">{mic.chroma?.best && (mic.chroma.confidence ?? 0) >= DIFFICULTY[difficulty].audio.threshold ? mic.chroma.best.symbol : tr("ui.unclear")}</span>
                  <ProgressBar value={mic.chroma?.confidence ?? 0} className="max-w-40" label={tr("ui.detection_confidence")} />
                  <span className="tabular-nums text-muted">{Math.round((mic.chroma?.confidence ?? 0) * 100)}% confidence</span>
                </div>
              )}
              {mic.error && <p className="mt-2 text-sm text-muted">{tr("ui.you_can_still_use_self_reported_mode")}</p>}
              <p className="mt-2 text-xs text-muted">{tr("ui.audio_chord_detection_is_a_best_effort_estimate")}</p>
            </div>
          )}

          {/* Big display */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-surface-2 p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted">{length === "timed" ? tr("ui.time_left") : tr("ui.time")}</p>
              <p className="font-mono text-5xl font-semibold tabular-nums" role="timer" aria-live="off" data-testid="drill-clock">
                {length === "timed" ? formatClock(timer.status === "idle" ? 60_000 : remaining) : formatClock(elapsed)}
              </p>
              {length === "timed" && <ProgressBar value={timer.status === "idle" ? 1 : remaining / 60_000} className="mt-2" tone="guitar" label={tr("ui.time_remaining")} />}
            </div>
            <div key={trans.count} className={cn("rounded-2xl bg-surface-2 p-4 text-center", trans.count > 0 && "animate-pop")}>
              <p className="text-xs uppercase tracking-wide text-muted">{tr("ui.changes")}</p>
              <p className="text-6xl font-bold tabular-nums text-guitar" aria-live="polite" data-testid="drill-count">{trans.count}</p>
              <p className="text-xs text-muted">{mode === "self" ? tr("ui.self_reported_2") : tr("ui.by_audio_manual", { audio: trans.byAudio, manual: trans.manual })}</p>
            </div>
            <div className="rounded-2xl bg-surface-2 p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted">{running ? tr("ui.change_to") : tr("ui.start_on")}</p>
              <p className="text-5xl font-bold">{running ? target : pair[0]}</p>
              <p className="text-xs text-muted">{running ? tr("ui.now_holding", { chord: holding }) : tr("ui.then_switch_to", { chord: pair[1] })}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {timer.status === "idle" && <Button size="lg" onClick={start} data-testid="drill-start"><Play className="h-5 w-5" /> {tr("common.start")}</Button>}
            {timer.status === "running" && <Button size="lg" variant="secondary" onClick={pause} data-testid="drill-pause"><Pause className="h-5 w-5" /> {tr("sheet.pause")}</Button>}
            {timer.status === "paused" && <Button size="lg" onClick={resume} data-testid="drill-resume"><Play className="h-5 w-5" /> {tr("ui.resume")}</Button>}
            {timer.status !== "idle" && <Button size="lg" variant="ghost" onClick={restart} data-testid="drill-restart"><RotateCcw className="h-5 w-5" /> {tr("ui.restart")}</Button>}
            {length === "untimed" && (timer.status === "running" || timer.status === "paused") && <Button size="lg" variant="success" onClick={finishUntimed}><CheckCircle2 className="h-5 w-5" /> {tr("lesson.finish")}</Button>}
            {running && (
              <Button size="lg" variant="outline" className="min-w-48 border-guitar text-guitar" onClick={countChange} data-testid="drill-tap">
                <Hand className="h-5 w-5" /> {mode === "self" ? tr("ui.changed_space") : tr("ui.confirm_change_manually")}
              </Button>
            )}
          </div>
          <MetronomeWidget initialBpm={DIFFICULTY[difficulty].bpm} key={difficulty} />
        </CardBody>
      </Card>

      {/* Result */}
      {finished && (
        <Card className="border-guitar/40">
          <CardHeader icon={<Trophy className="h-5 w-5" />} title={finished.result.untimed ? tr(finished.result.transitions === 1 ? "ui.change_untimed" : "ui.changes_untimed", { n: finished.result.transitions, sec: finished.result.durationSec }) : tr(finished.result.transitions === 1 ? "ui.change_in_60" : "ui.changes_in_60", { n: finished.result.transitions })} description={`${pair[0]} ↔ ${pair[1]}`} action={<SourceTag source={finished.result.mode === "self" ? "self-reported" : "measured"} />} />
          <CardBody className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {best !== undefined && <Badge tone="guitar">{tr("ui.personal_best_n", { n: Math.max(best, finished.result.untimed ? 0 : finished.result.transitions) })}</Badge>}
              {finished.result.mode === "audio" && <Badge>{tr("ui.audio_confirmed_manual", { audio: finished.result.confirmedByAudio ?? 0, manual: finished.result.confirmedManually ?? 0 })}</Badge>}
              {finished.result.cleanRate !== undefined && <Badge tone="success">{tr("ui.clean_detection_rate", { pct: Math.round(finished.result.cleanRate * 100) })}</Badge>}
            </div>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              {drillSuggestions(finished.result.transitions, finished.previousBest, finished.result.mode, finished.ambiguous).map((s) => <li key={s.key}>{tm(s)}</li>)}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={start}><RotateCcw className="h-4 w-4" /> {tr("ui.repeat_this_pair")}</Button>
              {pairKey(rec.pair) !== pairKey(pair) && <Button variant="secondary" onClick={() => choosePair(rec.pair)}>{tr("ui.try_pair", { a: rec.pair[0], b: rec.pair[1] })}</Button>}
            </div>
            <p className="text-xs text-muted">{tr("ui.recommended_next")} <strong className="text-text">{rec.pair.join(" ↔ ")}</strong> — {tx(rec.reason)}</p>
          </CardBody>
        </Card>
      )}

      {/* History & goal */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<BarChart3 className="h-5 w-5" />} title={tr("ui.history_pair", { a: pair[0], b: pair[1] })} description={tr("ui.your_last_ten_timed_drills_for_this_pair")} />
          <CardBody>
            {timedHistory.length === 0 ? (
              <EmptyState title={tr("ui.no_timed_drills_yet")} description={tr("ui.your_scores_for_this_pair_will_appear_here")} />
            ) : (
              <div className="flex h-40 items-end gap-2" role="img" aria-label={tr("ui.scores_list", { list: timedHistory.map((d) => d.transitions).join(", ") })}>
                {timedHistory.map((d) => {
                  const max = Math.max(...timedHistory.map((x) => x.transitions), 1);
                  return (
                    <div key={d.id} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs tabular-nums text-muted">{d.transitions}</span>
                      <div className={cn("w-full rounded-t-md", d.mode === "self" ? "bg-guitar/70" : "bg-success/70")} style={{ height: `${(d.transitions / max) * 100}%`, minHeight: 4 }} title={`${new Date(d.date).toLocaleString()} · ${d.mode === "self" ? tr("ui.self_reported_2") : tr("ui.audio_assisted_2")}`} />
                      <span className="text-[10px] text-subtle">{new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-muted"><span className="inline-block h-2 w-2 rounded-sm bg-guitar/70" /> {tr("ui.self_reported_2")} · <span className="inline-block h-2 w-2 rounded-sm bg-success/70" /> {tr("ui.audio_assisted_2")}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Trophy className="h-5 w-5" />} title={tr("dash.thisWeek")} description={tr("ui.short_regular_drills_beat_one_long_session")} />
          <CardBody className="space-y-3 text-sm">
            <div>
              <div className="mb-1 flex justify-between"><span>{tr("ui.drills_this_week")}</span><span className="tabular-nums text-muted">{tr("ui.drills_goal", { n: week.drills, goal: goals.data.weeklyChordDrills })}</span></div>
              <ProgressBar value={goals.data.weeklyChordDrills ? week.drills / goals.data.weeklyChordDrills : 1} tone="guitar" label={tr("ui.weekly_chord_drill_goal")} />
            </div>
            <p className="text-muted">{tr("ui.changes_last_7", { n: week.transitions })}</p>
            <p className="text-muted">{tr("ui.unlocked_level")} <strong className="text-text">{tx(TIER_NAMES[tierUnlocked])}</strong>{tr("ui.score_30_on_two_pairs_in_a_level_to_unlock_the_n")}</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
