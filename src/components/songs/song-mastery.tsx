"use client";
import { useT } from "@/lib/i18n";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, Timer, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardBody, CardHeader, ProgressBar, SourceTag, cn } from "@/components/ui";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { songRepo } from "@/lib/storage/repositories";
import { chordDifficulty } from "@/lib/music/chords";
import { songShapes, type Instrument } from "@/lib/songs/known-chords";
import { songStatus } from "@/lib/songs/status";
import { songChords } from "@/content/songs/parse";
import type { Song } from "@/content/songs/types";
import type { SongProgress } from "@/lib/storage/schemas";
import { SongStatusChip } from "./song-status-chip";

/** Per-section "I can play this" marks and the overall song mastery. */
export function SongMasteryCard({ song, instrument, progress }: { song: Song; instrument: Instrument; progress?: SongProgress }) {
  const tr = useT();
  const status = songStatus(song, progress);
  const mastered = new Set(progress?.sectionsMastered ?? []);
  const toggle = (id: string) =>
    void songRepo.upsert(song.id, instrument, (p) => {
      const set = new Set(p.sectionsMastered);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...p, sectionsMastered: [...set] };
    });

  return (
    <Card data-testid="song-mastery">
      <CardHeader
        title={tr("ui.can_you_play_it")}
        description={tr(instrument === "guitar" ? "ui.mark_sections_guitar" : "ui.mark_sections_piano")}
        action={<SourceTag source="self-reported" />}
      />
      <CardBody className="space-y-3">
        <div className="flex items-center gap-3">
          <ProgressBar value={status.pct} tone="success" label={tr("ui.song_mastery")} className="flex-1" />
          <span className="text-sm font-semibold tabular-nums">{Math.round(status.pct * 100)}%</span>
          <SongStatusChip status={status} />
        </div>
        <ul className="space-y-1.5">
          {song.sections.map((s) => {
            const on = mastered.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => toggle(s.id)}
                  className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm transition-colors", on ? "border-transparent bg-success-soft" : "border-border hover:bg-surface-2")}
                  data-testid={`section-mastered-${s.id}`}
                >
                  {on ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <Circle className="h-5 w-5 shrink-0 text-subtle" />}
                  <span className="flex-1 font-medium">{s.name}</span>
                  <span className={cn("text-xs", on ? "text-success" : "text-muted")}>{on ? tr("ui.i_can_play_this") : tr("ui.not_yet")}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {status.state === "mastered" && (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <Trophy className="h-4 w-4" /> {tr("ui.song_mastered_it_now_counts_towards_the_chords_y")}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/** The song's hardest change between two different chords (by shape difficulty). */
export function hardestPair(song: Pick<Song, "sections" | "sourceCapo">, instrument: Instrument): [string, string] | null {
  const capo = instrument === "guitar" ? song.sourceCapo ?? 0 : 0;
  const shapes = songShapes(song, instrument);
  const seq = songChords(song)
    .map((c) => songShapes({ sections: [{ id: "x", name: "x", bars: [c] }], sourceCapo: capo }, instrument)[0])
    .filter(Boolean);
  let best: [string, string] | null = null;
  let bestScore = -1;
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1];
    const b = seq[i];
    if (a === b) continue;
    const score = chordDifficulty(a) + chordDifficulty(b);
    if (score > bestScore) {
      bestScore = score;
      best = [a, b];
    }
  }
  return best ?? (shapes.length >= 2 ? [shapes[0], shapes[1]] : null);
}

const DRILL_SECONDS = 30;

/** 30-second self-reported chord change counter for the song's hardest pair. */
export function SongChangeDrill({ song, instrument, progress }: { song: Song; instrument: Instrument; progress?: SongProgress }) {
  const tr = useT();
  const pair = useMemo(() => hardestPair(song, instrument), [song, instrument]);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [count, setCount] = useState(0);
  const [left, setLeft] = useState(DRILL_SECONDS);
  const startedAt = useRef(0);
  const countRef = useRef(0);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, DRILL_SECONDS - (performance.now() - startedAt.current) / 1000);
      setLeft(Math.ceil(remaining));
      if (remaining <= 0) {
        window.clearInterval(id);
        setPhase("done");
        const perMinute = countRef.current * (60 / DRILL_SECONDS);
        void songRepo.upsert(song.id, instrument, (p) => ({ ...p, bestChangesPerMinute: Math.max(p.bestChangesPerMinute ?? 0, perMinute) }));
        if (perMinute > (progress?.bestChangesPerMinute ?? 0)) toast.success(tr("ui.new_best_cpm", { n: perMinute }));
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, song.id, instrument, progress?.bestChangesPerMinute, tr]);

  if (!pair) return null;
  const start = () => {
    countRef.current = 0;
    setCount(0);
    setLeft(DRILL_SECONDS);
    startedAt.current = performance.now();
    setPhase("running");
  };
  const tap = () => {
    if (phase !== "running") return;
    countRef.current += 1;
    setCount(countRef.current);
  };

  return (
    <Card data-testid="song-change-drill">
      <CardHeader
        icon={<Timer className="h-5 w-5" />}
        title={tr("ui.chord_change_speed")}
        description={tr("ui.trickiest_change", { a: pair[0], b: pair[1], s: DRILL_SECONDS })}
        action={<SourceTag source="self-reported" />}
      />
      <CardBody className="space-y-4">
        {instrument === "guitar" && (
          <div className="flex gap-2">
            <ChordDiagram chord={pair[0]} size="sm" />
            <ChordDiagram chord={pair[1]} size="sm" />
          </div>
        )}
        {phase === "running" ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-5xl tabular-nums" aria-live="off">{count}</span>
              <span className="text-sm tabular-nums text-muted" aria-live="polite">{left}s left</span>
            </div>
            <Button size="lg" className="h-16 w-full text-lg" onClick={tap} data-testid="drill-tap">
              {tr("ui.changed")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={start} data-testid="drill-start">{phase === "done" ? tr("ui.try_again") : tr("ui.start_30_seconds")}</Button>
            {phase === "done" && <span className="text-sm">{tr("ui.this_round")} <strong>{count * (60 / DRILL_SECONDS)}</strong> {tr("ui.changes_min")}</span>}
            <span className="text-sm text-muted">{tr("dash.drillBest")} <strong className="text-text">{progress?.bestChangesPerMinute ? `${progress.bestChangesPerMinute}/min` : "—"}</strong></span>
          </div>
        )}
        <p className="text-xs text-muted">{tr("ui.clean_changes_beat_fast_ones_only_tap_when_every")}</p>
      </CardBody>
    </Card>
  );
}
