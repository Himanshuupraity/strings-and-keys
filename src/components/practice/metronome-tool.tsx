"use client";
import { useT } from "@/lib/i18n";

import { useRef, useState } from "react";
import { Hand, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { useMetronome } from "@/hooks/use-metronome";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { Button, Card, CardBody, CardHeader, Segmented, Slider, Switch, cn } from "@/components/ui";
import { MAX_BPM, MIN_BPM, TapTempo } from "@/lib/audio/scheduler";

const SIGNATURES = [
  { id: "2/4", beats: 2, label: "2/4" },
  { id: "3/4", beats: 3, label: "3/4" },
  { id: "4/4", beats: 4, label: "4/4" },
  { id: "5/4", beats: 5, label: "5/4" },
  { id: "6/8", beats: 6, label: "6/8" },
] as const;

const TEMPO_NAMES: [number, string][] = [[60, "Largo"], [76, "Adagio"], [108, "Andante"], [120, "Moderato"], [168, "Allegro"], [240, "Presto"]];
const tempoName = (bpm: number) => TEMPO_NAMES.find(([b]) => bpm <= b)?.[1] ?? "Presto";

export function MetronomeTool() {
  const tr = useT();
  const [sig, setSig] = useState<(typeof SIGNATURES)[number]["id"]>("4/4");
  const { ping } = usePracticeLog("Metronome practice");
  const m = useMetronome({ bpm: 80, beatsPerBar: 4, accent: true }, () => ping());
  const tap = useRef(new TapTempo());
  const [tapped, setTapped] = useState<number | null>(null);
  const is68 = sig === "6/8";

  const changeSig = (id: (typeof SIGNATURES)[number]["id"]) => {
    setSig(id);
    m.setBeatsPerBar(SIGNATURES.find((s) => s.id === id)!.beats);
  };

  const onTap = () => {
    const bpm = tap.current.tap(performance.now());
    if (bpm) {
      m.setBpm(bpm);
      setTapped(bpm);
    }
  };

  // In 6/8 the clicks are eighth notes; beats 1 and 4 are the felt pulses.
  const strong = (i: number) => i === 0 || (is68 && i === 3);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardBody className="flex flex-col items-center gap-6 py-8">
          <div className="text-center">
            <div className="font-display text-8xl tabular-nums leading-none" aria-live="polite" data-testid="metronome-bpm">{m.bpm}</div>
            <div className="mt-1 text-sm text-muted">BPM · {tempoName(m.bpm)}{is68 ? tr("ui.eighth_note_clicks") : ""}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-3" aria-label={tr("ui.beat_indicator")}>
            {Array.from({ length: m.beatsPerBar }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "flex items-center justify-center rounded-full border-2 font-semibold transition-all duration-75",
                  strong(i) ? "h-16 w-16 text-lg" : "h-12 w-12",
                  m.beat === i ? (i === 0 && m.accent ? "scale-110 border-accent bg-accent text-accent-fg" : "scale-105 border-text bg-text text-bg") : "border-border-strong text-muted",
                )}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="icon" aria-label={tr("ui.decrease_tempo_by_1")} onClick={() => m.setBpm(m.bpm - 1)}><Minus className="h-5 w-5" /></Button>
            <Button size="lg" onClick={m.toggle} className="min-w-36" data-testid="metronome-toggle">
              {m.running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {m.running ? "Stop" : "Start"}
            </Button>
            <Button variant="secondary" size="icon" aria-label={tr("ui.increase_tempo_by_1")} onClick={() => m.setBpm(m.bpm + 1)}><Plus className="h-5 w-5" /></Button>
          </div>
          <Slider className="w-full max-w-lg" label={tr("ui.tempo")} value={m.bpm} min={MIN_BPM} max={MAX_BPM} onChange={m.setBpm} format={(v) => `${v} BPM`} />
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title={tr("nav./settings")} />
          <CardBody className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">{tr("ui.time_signature")}</p>
              <Segmented label={tr("ui.time_signature")} value={sig} onChange={changeSig} options={SIGNATURES.map((s) => ({ value: s.id, label: s.label }))} className="w-full" />
            </div>
            <Switch label={tr("ui.accent_the_first_beat")} description={tr("ui.a_higher_click_on_beat_1_helps_you_feel_the_bar")} checked={m.accent} onChange={m.setAccent} />
            <div className="space-y-2">
              <p className="text-sm font-medium">{tr("ui.tap_tempo")}</p>
              <Button variant="secondary" className="w-full" onClick={onTap}><Hand className="h-4 w-4" /> {tr("ui.tap_here_in_time")}{tapped ? ` · ${tapped} BPM` : ""}</Button>
              <p className="text-xs text-muted">{tr("ui.tap_at_least_twice_at_the_speed_of_a_song_you_li")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[60, 80, 100, 120].map((b) => <Button key={b} size="sm" variant="ghost" onClick={() => m.setBpm(b)}>{b}</Button>)}
              <Button size="sm" variant="outline" onClick={() => { m.stop(); m.setBpm(80); changeSig("4/4"); m.setAccent(true); tap.current.reset(); setTapped(null); }}><RotateCcw className="h-4 w-4" /> {tr("ui.reset")}</Button>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2 pt-5 text-sm text-muted">
            <p className="font-medium text-text">{tr("ui.how_to_practise_with_a_metronome")}</p>
            <p>{tr("ui.start_slow_enough_that_you_can_play_without_mist")}</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
