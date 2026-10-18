"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Gauge, Piano, Play, RotateCcw, TrendingUp } from "lucide-react";
import { useNoteInput, type NoteSource } from "@/hooks/use-note-input";
import { usePrefs } from "@/hooks/use-prefs";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { MicButton } from "@/components/instruments/mic-button";
import { NoteText } from "@/components/instruments/note-label";
import { PianoKeyboard, type KeyTone } from "@/components/instruments/piano-keyboard";
import { Fretboard, type FretMark } from "@/components/instruments/fretboard";
import { MetronomeWidget } from "@/components/practice/metronome-widget";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Segmented, Select, Slider, SourceTag, Switch, cn } from "@/components/ui";
import { SCALE_TYPES, scaleNoteNames, type ScaleTypeId } from "@/lib/music/scales";
import { midiToName, mod12, pitchClassOf } from "@/lib/music/notes";
import { positionsOfMidi } from "@/lib/music/guitar";
import { mistakeSummary, sequenceAccuracy, startSequence, stepSequence, type SequenceState } from "@/lib/exercises/sequence";
import { playSequence } from "@/lib/audio/engine";
import { exerciseRepo } from "@/lib/storage/repositories";
import { MAJOR_KEYS } from "@/lib/music/transpose";
import { scaleRun, timingEvenness } from "./logic/scale-run";

interface Run {
  key: string;
  seq: SequenceState;
  times: number[];
  lastWrong: number | null;
}

const TYPES = Object.keys(SCALE_TYPES).filter((t) => t !== "chromatic") as ScaleTypeId[];

export function ScaleTrainer() {
  const [prefs] = usePrefs();
  const instrument = prefs.instrument;
  const [tonic, setTonic] = useState("C");
  const [type, setType] = useState<ScaleTypeId>("major");
  const [direction, setDirection] = useState<"up" | "up-down">("up");
  const [tempo, setTempo] = useState(60);
  const [autoSpeed, setAutoSpeed] = useState(true);
  const notes = useMemo(() => scaleRun(tonic, type, instrument, direction), [tonic, type, instrument, direction]);
  const runKey = `${tonic}|${type}|${instrument}|${direction}`;
  const fresh = (): Run => ({ key: runKey, seq: startSequence(notes), times: [], lastWrong: null });
  const [stored, setRun] = useState<Run>(fresh);
  // Changing key / scale / direction / instrument starts a fresh run (derived, no effect needed).
  const run = stored.key === runKey ? stored : fresh();
  const { seq, times, lastWrong } = run;
  const [source, setSource] = useState<NoteSource | null>(null);
  const { ping } = usePracticeLog("Scale trainer");
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  const save = (done: SequenceState, doneTimes: number[], src: NoteSource) => {
    const ev = timingEvenness(doneTimes, 60000 / tempo);
    void exerciseRepo.add({
      instrument,
      exerciseId: `scale:${tonic}-${type}`,
      skill: `scale:${type}`,
      input: src === "mic" ? "mic" : src === "midi" ? "midi" : "virtual",
      correct: done.wrongBefore.filter((w) => w === 0).length,
      total: done.targets.length,
      accuracy: sequenceAccuracy(done),
      timingErrorMs: ev?.meanErr,
      measured: true,
      details: `${tonic} ${SCALE_TYPES[type].name} at ${tempo} BPM`,
    });
  };

  const onNote = (midi: number, src: NoteSource) => {
    const cur = runRef.current;
    const r = stepSequence(cur.seq, midi);
    if (r.verdict === "ignored") return;
    ping();
    setSource(src);
    const next: Run =
      r.verdict === "correct"
        ? { ...cur, seq: r.state, times: [...cur.times, performance.now()], lastWrong: null }
        : { ...cur, seq: r.state, lastWrong: midi };
    runRef.current = next;
    setRun(next);
    if (r.state.done) save(r.state, next.times, src);
  };
  const input = useNoteInput(onNote);

  const accuracy = sequenceAccuracy(seq);
  const evenness = timingEvenness(times, 60000 / tempo);

  const reset = (speedUp = false) => {
    if (speedUp) setTempo((t) => Math.min(200, t + 5));
    const f = fresh();
    runRef.current = f;
    setRun(f);
  };

  const target = seq.done ? null : seq.targets[seq.index];
  const pcs = notes.map(mod12);
  const tonicPc = pitchClassOf(tonic);
  const name = (m: number) => midiToName(m, prefs.spelling);

  const highlight: Partial<Record<number, KeyTone>> = {};
  notes.forEach((n) => (highlight[n] = mod12(n) === tonicPc ? "root" : "scale"));
  seq.targets.slice(0, seq.index).forEach((n) => (highlight[n] = "correct"));
  if (target !== null) highlight[target] = "target";
  if (lastWrong !== null) highlight[lastWrong] = "wrong";

  const marks: FretMark[] = target !== null ? positionsOfMidi(target, prefs.fretCount).map((p) => ({ string: p.string, fret: p.fret, tone: "target" as const })) : [];
  if (lastWrong !== null) positionsOfMidi(lastWrong, prefs.fretCount).forEach((p) => marks.push({ string: p.string, fret: p.fret, tone: "wrong" }));

  const clean = seq.done && accuracy === 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-wrap items-end gap-4 pt-5">
          <div className="space-y-1">
            <label htmlFor="st-tonic" className="text-sm font-medium">Key</label>
            <Select id="st-tonic" value={tonic} onChange={(e) => setTonic(e.target.value)}>
              {MAJOR_KEYS.map((k) => <option key={k}>{k}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="st-type" className="text-sm font-medium">Scale</label>
            <Select id="st-type" value={type} onChange={(e) => setType(e.target.value as ScaleTypeId)}>
              {TYPES.map((t) => <option key={t} value={t}>{SCALE_TYPES[t].name}</option>)}
            </Select>
          </div>
          <Segmented label="Direction" value={direction} onChange={setDirection} options={[{ value: "up", label: "Up" }, { value: "up-down", label: "Up & down" }]} />
          <Button variant="secondary" onClick={() => void playSequence(instrument, notes, 60 / tempo)}><Play className="h-4 w-4" /> Demonstrate at {tempo} BPM</Button>
        </CardBody>
        <CardBody>
          <p className="text-sm text-muted">{SCALE_TYPES[type].description}</p>
          <p className="mt-1 text-sm">Notes: <strong>{scaleNoteNames(tonic, type).join(" ")}</strong></p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={target !== null ? <>Play <span className="text-accent"><NoteText midi={target} withOctave /></span></> : "Scale complete!"}
          description={`Note ${Math.min(seq.index + 1, seq.targets.length)} of ${seq.targets.length}. Use the ${instrument === "guitar" ? "fretboard" : "keyboard"} below, a MIDI keyboard, or your real instrument with the microphone.`}
          action={<Badge tone={instrument}>{instrument === "guitar" ? "Guitar" : "Piano"} mode</Badge>}
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-1.5" aria-label="Progress through the scale">
            {seq.targets.map((n, i) => (
              <span key={i} className={cn("rounded-lg px-2 py-1 text-sm font-medium", i < seq.index ? (seq.wrongBefore[i] ? "bg-warn-soft text-warn" : "bg-success-soft text-success") : i === seq.index ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}>
                <NoteText midi={n} />
              </span>
            ))}
          </div>
          {instrument === "piano" ? (
            <PianoKeyboard low={48} high={84} highlight={highlight} pressed={input.midi.held} onNoteOn={(m) => onNote(m, "virtual")} labels="white" focusMidi={notes[0] + 6} whiteKeyWidth={40} />
          ) : (
            <Fretboard marks={marks} highlightPitchClasses={pcs} rootPc={tonicPc} onPlay={(p) => onNote(p.midi, "virtual")} />
          )}
          {lastWrong !== null && target !== null && (
            <p className="text-sm text-danger" aria-live="polite">That was {name(lastWrong)} — the next note is {name(target)} ({lastWrong > target ? "lower" : "higher"}).</p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tempo & play-along" icon={<Gauge className="h-5 w-5" />} />
          <CardBody className="space-y-4">
            <Slider label="Target tempo" value={tempo} min={40} max={200} step={5} onChange={setTempo} format={(v) => `${v} BPM`} />
            <MetronomeWidget key={tempo} initialBpm={tempo} />
            <Switch label="Gradual speed-up" description="After a clean run (no mistakes), go 5 BPM faster." checked={autoSpeed} onChange={setAutoSpeed} />
            <p className="text-xs text-muted">Start slow. Speed comes from accuracy, not the other way round.</p>
          </CardBody>
        </Card>
        <Card aria-live="polite">
          <CardHeader title="Your run" action={seq.done ? <SourceTag source="measured" /> : undefined} />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-surface-2 p-3"><p className="text-2xl font-semibold">{seq.wrongBefore.slice(0, seq.index).filter((w) => w === 0).length}</p><p className="text-xs text-muted">first-try correct</p></div>
              <div className="rounded-xl bg-surface-2 p-3"><p className="text-2xl font-semibold">{seq.mistakes.length}</p><p className="text-xs text-muted">wrong notes</p></div>
              <div className="rounded-xl bg-surface-2 p-3"><p className="text-2xl font-semibold">{evenness ? `${Math.round(evenness.steadiness * 100)}%` : "—"}</p><p className="text-xs text-muted">steadiness</p></div>
            </div>
            {evenness && <p className="text-sm text-muted">Average gap between notes {Math.round(evenness.mean)} ms (target at {tempo} BPM: {Math.round(60000 / tempo)} ms).{source === "mic" ? " Microphone timing includes a little detection delay." : ""}</p>}
            {mistakeSummary(seq, name) && <p className="text-sm">{mistakeSummary(seq, name)}</p>}
            {seq.done && (
              <Callout tone={clean ? "success" : "neutral"} icon={<CheckCircle2 className="h-4 w-4" />} title={clean ? "Clean run!" : `Finished with ${Math.round(accuracy * 100)}% first-try accuracy`}>
                {clean ? (autoSpeed ? `Next run at ${Math.min(200, tempo + 5)} BPM.` : "Try it a little faster, or with your eyes off the screen.") : "Repeat at the same tempo until it's clean."}
              </Callout>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => reset(false)}><RotateCcw className="h-4 w-4" /> Restart</Button>
              {clean && autoSpeed && <Button onClick={() => reset(true)}><TrendingUp className="h-4 w-4" /> Again, 5 BPM faster</Button>}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Play your real instrument" icon={<Piano className="h-5 w-5" />} description="The microphone counts a note once it hears a clear, steady pitch. Play one note at a time." />
        <CardBody className="flex flex-wrap items-start gap-6">
          <MicButton status={input.mic.status} error={input.mic.error} onStart={() => void input.mic.start()} onStop={input.mic.stop} />
          {input.midi.supported && (input.midi.status === "connected" ? <Badge tone="success">MIDI: {input.midi.devices.join(", ") || "waiting for device"}</Badge> : <Button variant="secondary" onClick={() => void input.midi.connect()}>Connect MIDI</Button>)}
        </CardBody>
      </Card>
    </div>
  );
}
