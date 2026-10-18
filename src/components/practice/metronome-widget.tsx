"use client";
import { useT } from "@/lib/i18n";

import { Minus, Pause, Play, Plus } from "lucide-react";
import { useMetronome } from "@/hooks/use-metronome";
import { Button, cn } from "@/components/ui";
import type { BeatEvent } from "@/lib/audio/scheduler";

/** Compact metronome for labs, lessons and songs. The full tool lives at /practice/metronome. */
export function MetronomeWidget({ initialBpm = 70, beatsPerBar = 4, onBeat, className }: { initialBpm?: number; beatsPerBar?: number; onBeat?: (e: BeatEvent & { audioTime: number }) => void; className?: string }) {
  const tr = useT();
  const m = useMetronome({ bpm: initialBpm, beatsPerBar }, onBeat);
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2", className)}>
      <Button size="sm" variant={m.running ? "secondary" : "primary"} onClick={m.toggle} aria-label={m.running ? tr("ui.stop_metronome") : tr("ui.start_metronome")}>
        {m.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {m.running ? "Stop" : "Metronome"}
      </Button>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-10 w-10 sm:h-8 sm:w-8" aria-label={tr("ui.slower")} onClick={() => m.setBpm(m.bpm - 5)}>
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-16 text-center text-sm font-semibold tabular-nums" aria-live="polite">{m.bpm} BPM</span>
        <Button size="icon" variant="ghost" className="h-10 w-10 sm:h-8 sm:w-8" aria-label={tr("ui.faster")} onClick={() => m.setBpm(m.bpm + 5)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: m.beatsPerBar }, (_, i) => (
          <span key={i} className={cn("h-3 w-3 rounded-full transition-colors", m.beat === i ? (i === 0 ? "bg-accent" : "bg-text") : "bg-surface-3")} />
        ))}
      </div>
    </div>
  );
}
