"use client";

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
            <div className="mt-1 text-sm text-muted">BPM · {tempoName(m.bpm)}{is68 ? " (eighth-note clicks)" : ""}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-3" aria-label="Beat indicator">
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
            <Button variant="secondary" size="icon" aria-label="Decrease tempo by 1" onClick={() => m.setBpm(m.bpm - 1)}><Minus className="h-5 w-5" /></Button>
            <Button size="lg" onClick={m.toggle} className="min-w-36" data-testid="metronome-toggle">
              {m.running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {m.running ? "Stop" : "Start"}
            </Button>
            <Button variant="secondary" size="icon" aria-label="Increase tempo by 1" onClick={() => m.setBpm(m.bpm + 1)}><Plus className="h-5 w-5" /></Button>
          </div>
          <Slider className="w-full max-w-lg" label="Tempo" value={m.bpm} min={MIN_BPM} max={MAX_BPM} onChange={m.setBpm} format={(v) => `${v} BPM`} />
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Settings" />
          <CardBody className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">Time signature</p>
              <Segmented label="Time signature" value={sig} onChange={changeSig} options={SIGNATURES.map((s) => ({ value: s.id, label: s.label }))} className="w-full" />
            </div>
            <Switch label="Accent the first beat" description="A higher click on beat 1 helps you feel the bar." checked={m.accent} onChange={m.setAccent} />
            <div className="space-y-2">
              <p className="text-sm font-medium">Tap tempo</p>
              <Button variant="secondary" className="w-full" onClick={onTap}><Hand className="h-4 w-4" /> Tap here in time{tapped ? ` · ${tapped} BPM` : ""}</Button>
              <p className="text-xs text-muted">Tap at least twice at the speed of a song you like.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[60, 80, 100, 120].map((b) => <Button key={b} size="sm" variant="ghost" onClick={() => m.setBpm(b)}>{b}</Button>)}
              <Button size="sm" variant="outline" onClick={() => { m.stop(); m.setBpm(80); changeSig("4/4"); m.setAccent(true); tap.current.reset(); setTapped(null); }}><RotateCcw className="h-4 w-4" /> Reset</Button>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2 pt-5 text-sm text-muted">
            <p className="font-medium text-text">How to practise with a metronome</p>
            <p>Start slow enough that you can play without mistakes. When you can do it cleanly three times in a row, raise the tempo by 5 BPM.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
