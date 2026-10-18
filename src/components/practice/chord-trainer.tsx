"use client";

import { useEffect, useRef, useState } from "react";
import { Ear, Piano, RotateCcw, Shuffle, Volume2 } from "lucide-react";
import { useMic } from "@/hooks/use-mic";
import { useMidi } from "@/hooks/use-midi";
import { usePrefs } from "@/hooks/use-prefs";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { MicButton } from "@/components/instruments/mic-button";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { PianoKeyboard } from "@/components/instruments/piano-keyboard";
import { Badge, Button, Callout, Card, CardBody, CardHeader, ProgressBar, Select, SourceTag, cn } from "@/components/ui";
import { chordMidi, chordNoteNames, compareChordTones, easiestShape, shapeMidi } from "@/lib/music/chords";
import { mod12 } from "@/lib/music/notes";
import { playPianoChord, strum } from "@/lib/audio/engine";
import { exerciseRepo } from "@/lib/storage/repositories";
import type { ChromaFrame } from "@/lib/audio/microphone";
import { summarizeChroma } from "./logic/chroma-window";

const GUITAR_CHORDS = ["Em", "Am", "E", "A", "D", "G", "C", "Dm", "E7", "A7", "D7", "G7", "Am7", "Em7", "Cmaj7", "F"];
const PIANO_CHORDS = ["C", "F", "G", "Am", "Dm", "Em", "D", "A", "E", "Bb", "Eb", "Cm", "Fm", "Gm", "G7", "Cmaj7", "Bdim", "Caug"];

type Result = {
  source: "midi" | "mic" | "virtual";
  detected: number[];
  missing: number[];
  unwanted: number[];
  coverage: number;
  confidence: number;
  guess?: string;
  found: number;
  chord: string;
};

export function ChordTrainer() {
  const [prefs] = usePrefs();
  const instrument = prefs.instrument;
  const list = instrument === "guitar" ? GUITAR_CHORDS : PIANO_CHORDS;
  const [chordChoice, setChord] = useState<string | null>(null);
  // Default (and fallback after switching instrument mode) is that instrument's first chord.
  const chord = chordChoice && list.includes(chordChoice) ? chordChoice : list[0];
  const [resultState, setResult] = useState<Result | null>(null);
  const result = resultState && resultState.chord === chord ? resultState : null;
  const [unclear, setUnclear] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [virtualHeld, setVirtualHeld] = useState<Set<number>>(new Set());
  const frames = useRef<ChromaFrame[]>([]);
  const { ping } = usePracticeLog("Chord trainer");

  const tones = chordNoteNames(chord);
  const shape = easiestShape(chord);
  const pianoNotes = chordMidi(chord, 4);
  const exampleNotes = instrument === "guitar" && shape ? shapeMidi(shape) : pianoNotes;

  const record = (r: Result) => {
    setResult(r);
    setUnclear(false);
    ping();
    void exerciseRepo.add({
      instrument,
      exerciseId: "chord-trainer",
      skill: `chord:${chord}`,
      input: r.source,
      correct: r.found,
      total: tones.length,
      accuracy: r.coverage * (r.unwanted.length ? 0.7 : 1),
      measured: r.source !== "mic" || r.confidence >= 0.5,
      details: `${chord}: missing ${r.missing.length}, unwanted ${r.unwanted.length}${r.source === "mic" ? `, confidence ${Math.round(r.confidence * 100)}%` : ""}`,
    });
  };

  const evaluate = (pcs: number[], source: Result["source"], confidence: number, guess?: string) => {
    const c = compareChordTones(chord, pcs);
    record({ chord, source, detected: pcs, missing: c.missing, unwanted: c.unwanted, coverage: c.coverage, confidence, guess, found: c.found.length });
  };

  // MIDI: evaluate once the student holds ≥ 2 notes steadily (exact data).
  const midi = useMidi();
  useEffect(() => {
    if (midi.held.size < 2) return;
    const t = setTimeout(() => evaluate([...new Set([...midi.held].map(mod12))], "midi", 1), 350);
    return () => clearTimeout(t);
  }, [midi.held]); // eslint-disable-line react-hooks/exhaustive-deps

  const mic = useMic({
    a4: prefs.a4,
    mode: "chroma",
    onChroma: (f) => {
      if (capturingRef.current) frames.current.push(f);
    },
  });
  const capturingRef = useRef(false);

  const listen = async () => {
    if (!mic.listening) await mic.start();
    frames.current = [];
    capturingRef.current = true;
    setCapturing(true);
    setResult(null);
    setUnclear(false);
    setTimeout(() => {
      capturingRef.current = false;
      setCapturing(false);
      const s = summarizeChroma(frames.current);
      if (!s || s.confidence < 0.3) {
        setUnclear(true);
        return;
      }
      evaluate(s.pcs, "mic", s.confidence, s.best?.symbol);
    }, 2500);
  };

  const pick = () => {
    const others = list.filter((c) => c !== chord);
    setChord(others[Math.floor(Math.random() * others.length)]);
    setResult(null);
    setUnclear(false);
  };

  const toneName = (pc: number) => compareChordTones(chord, []).name(pc);
  const correct = result && result.missing.length === 0 && result.unwanted.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card>
          <CardHeader
            title={<span className="font-display text-3xl">{chord}</span>}
            description={<>Notes: <strong className="text-text">{tones.join(" – ")}</strong></>}
            action={
              <div className="flex gap-2">
                <Select aria-label="Choose chord" value={chord} onChange={(e) => { setChord(e.target.value); setResult(null); }}>
                  {list.map((c) => <option key={c}>{c}</option>)}
                </Select>
                <Button variant="secondary" size="icon" aria-label="Random chord" onClick={pick}><Shuffle className="h-4 w-4" /></Button>
              </div>
            }
          />
          <CardBody className="space-y-4">
            {instrument === "guitar" ? (
              <div className="flex flex-wrap items-center gap-6">
                <ChordDiagram chord={chord} size="lg" />
                <div className="space-y-2 text-sm text-muted">
                  {shape?.tips?.map((t) => <p key={t}>• {t}</p>) ?? <p>Fret each note cleanly just behind the fret wire.</p>}
                </div>
              </div>
            ) : (
              <PianoKeyboard
                low={48}
                high={84}
                highlight={Object.fromEntries(pianoNotes.map((n) => [n, "chord" as const]))}
                pressed={new Set([...midi.held, ...virtualHeld])}
                onNoteOn={(m) => setVirtualHeld((h) => { const n = new Set(h); if (n.has(m)) n.delete(m); else n.add(m); return n; })}
                labels="all"
                focusMidi={64}
                whiteKeyWidth={38}
                height={150}
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void (instrument === "guitar" ? strum(exampleNotes) : playPianoChord(exampleNotes))}><Volume2 className="h-4 w-4" /> Play example</Button>
              <Button onClick={() => void listen()} loading={capturing} data-testid="chord-listen"><Ear className="h-4 w-4" /> {capturing ? "Listening… play now" : `Listen to my ${instrument === "guitar" ? "strum" : "chord"}`}</Button>
              {instrument === "piano" && virtualHeld.size > 0 && (
                <Button variant="outline" onClick={() => { evaluate([...new Set([...virtualHeld].map(mod12))], "virtual", 1); setVirtualHeld(new Set()); }}>Check selected keys</Button>
              )}
            </div>
            {instrument === "piano" && <p className="text-xs text-muted">Tip: click keys on the virtual keyboard to select them, then “Check selected keys”. A MIDI keyboard is checked automatically when you hold two or more notes.</p>}
          </CardBody>
        </Card>

        <Card aria-live="polite">
          <CardHeader title="Result" action={result && <SourceTag source={result.source === "mic" && result.confidence < 0.5 ? "rules" : "measured"} />} />
          <CardBody>
            {unclear && (
              <Callout tone="warn" title="I couldn't hear that clearly">
                Please {instrument === "guitar" ? "strum the chord again firmly and let it ring" : "play the chord again and hold it"} — closer to the microphone, in a quiet room. I won&apos;t guess when the signal is unclear.
              </Callout>
            )}
            {!result && !unclear && <p className="text-muted">Play the chord and press “Listen”, or use a MIDI keyboard.</p>}
            {result && (
              <div className="space-y-4">
                <div className={cn("rounded-xl p-4", correct ? "bg-success-soft" : "bg-warn-soft")}>
                  <p className="text-lg font-semibold">{correct ? `That sounds like ${chord}!` : result.coverage >= 0.66 ? "Close — check the notes below." : "Not quite yet."}</p>
                  <p className="text-sm text-muted">
                    {result.source === "midi" && "Measured exactly from your MIDI keyboard."}
                    {result.source === "virtual" && "Checked from the keys you selected."}
                    {result.source === "mic" && <>Estimated from microphone audio{result.guess ? ` (best guess: ${result.guess})` : ""}. Chord detection from audio is approximate.</>}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><p className="text-xs uppercase tracking-wide text-muted">Heard</p><p className="font-medium">{result.detected.map(toneName).join(", ") || "—"}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-muted">Missing</p><p className="font-medium text-danger">{result.missing.map(toneName).join(", ") || "None"}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-muted">Unwanted</p><p className="font-medium text-warn">{result.unwanted.map(toneName).join(", ") || "None"}</p></div>
                </div>
                {result.source === "mic" && (
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted"><span>Detection confidence</span><span>{Math.round(result.confidence * 100)}%</span></div>
                    <ProgressBar value={result.confidence} tone={result.confidence > 0.6 ? "success" : "accent"} label="Detection confidence" />
                  </div>
                )}
                {result.missing.length > 0 && instrument === "guitar" && <p className="text-sm text-muted">A missing note on guitar usually means a finger is touching a neighbouring string or not pressing firmly. Play each string one at a time to find the culprit.</p>}
                {result.unwanted.length > 0 && instrument === "guitar" && <p className="text-sm text-muted">Unwanted notes often come from strumming a string marked × — start your strum from the right string.</p>}
                <Button variant="secondary" size="sm" onClick={() => { setResult(null); void listen(); }}><RotateCcw className="h-4 w-4" /> Try again</Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Input" />
          <CardBody className="space-y-4">
            <MicButton status={mic.status} error={mic.error} onStart={() => void mic.start()} onStop={mic.stop} label="Turn on microphone" />
            <div className="border-t border-border pt-4">
              {midi.supported ? (
                midi.status === "connected" ? <Badge tone="success">MIDI: {midi.devices.join(", ") || "waiting for device"}</Badge> : <Button variant="secondary" onClick={() => void midi.connect()}><Piano className="h-4 w-4" /> Connect MIDI</Button>
              ) : <p className="text-xs text-muted">Web MIDI isn&apos;t available in this browser.</p>}
            </div>
          </CardBody>
        </Card>
        <Callout tone="info" title="What the microphone can and can't tell">
          It estimates which <em>notes</em> are sounding. It can&apos;t see your fingers, so it can&apos;t judge finger placement or pressure — use the chord diagram and your ears for that. MIDI keyboards give exact note data.
        </Callout>
      </div>
    </div>
  );
}
