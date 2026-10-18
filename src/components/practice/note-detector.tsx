"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, Piano, RotateCcw, Volume2, XCircle } from "lucide-react";
import { useMic } from "@/hooks/use-mic";
import { useMidi } from "@/hooks/use-midi";
import { usePrefs } from "@/hooks/use-prefs";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { MicButton } from "@/components/instruments/mic-button";
import { NoteText } from "@/components/instruments/note-label";
import { PianoKeyboard } from "@/components/instruments/piano-keyboard";
import { Badge, Button, Callout, Card, CardBody, CardHeader, SourceTag, cn } from "@/components/ui";
import { midiToName, mod12 } from "@/lib/music/notes";
import { playPianoNote } from "@/lib/audio/engine";
import { exerciseRepo } from "@/lib/storage/repositories";

type Verdict = { played: number; source: "mic" | "midi"; correct: boolean; cents?: number } | null;

export function NoteDetector() {
  const [prefs] = usePrefs();
  const [target, setTarget] = useState(60);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const { ping } = usePracticeLog("Piano note detector", { instrument: "piano" });
  const lastMic = useRef<number | null>(null);
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  });

  const judge = (played: number, source: "mic" | "midi", cents?: number) => {
    const correct = played === targetRef.current;
    setVerdict({ played, source, correct, cents });
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }));
    ping();
    void exerciseRepo.add({ instrument: "piano", exerciseId: "note-detector", skill: "note-finding", input: source, correct: correct ? 1 : 0, total: 1, accuracy: correct ? 1 : 0, measured: true, details: `target ${midiToName(targetRef.current)}, played ${midiToName(played)}` });
  };

  const mic = useMic({
    a4: prefs.a4,
    mode: "pitch",
    onPitch: (f) => {
      if (!f.note || !f.stable) {
        if (f.level < 0.01) lastMic.current = null;
        return;
      }
      if (lastMic.current === f.note.midi) return;
      lastMic.current = f.note.midi;
      judge(f.note.midi, "mic", f.note.cents);
    },
  });
  const midi = useMidi((e) => e.type === "on" && judge(e.midi, "midi"));

  const newTarget = () => {
    const pool = [60, 62, 64, 65, 67, 69, 71, 72, 57, 55, 53];
    setTarget(pool[Math.floor(Math.random() * pool.length)]);
    setVerdict(null);
    lastMic.current = null;
  };

  const diff = verdict ? verdict.played - target : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Target note" description="Pick a key below (or press 'New target'), then play that note on your real piano or keyboard." action={<Badge tone="piano">{score.right}/{score.total} correct</Badge>} />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="font-display text-6xl" data-testid="detector-target"><NoteText midi={target} withOctave /></div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => void playPianoNote(target, 1)}><Volume2 className="h-4 w-4" /> Hear it</Button>
                <Button variant="secondary" size="sm" onClick={newTarget}><RotateCcw className="h-4 w-4" /> New target</Button>
              </div>
            </div>
            <PianoKeyboard low={48} high={84} highlight={{ [target]: "target", ...(verdict && !verdict.correct ? { [verdict.played]: "wrong" as const } : {}), ...(verdict?.correct ? { [target]: "correct" as const } : {}) }} pressed={midi.held} onNoteOn={(m) => { setTarget(m); setVerdict(null); }} labels="white" focusMidi={66} whiteKeyWidth={38} height={150} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="What I heard" action={verdict && <SourceTag source="measured" />} />
          <CardBody aria-live="polite">
            {!verdict ? (
              <p className="text-muted">{mic.listening || midi.status === "connected" ? "Play one note and hold it for a moment…" : "Start listening with the microphone or connect a MIDI keyboard."}</p>
            ) : (
              <div className={cn("flex items-start gap-3 rounded-xl p-4", verdict.correct ? "bg-success-soft" : "bg-danger-soft")}>
                {verdict.correct ? <CheckCircle2 className="mt-0.5 h-6 w-6 text-success" /> : <XCircle className="mt-0.5 h-6 w-6 text-danger" />}
                <div>
                  <p className="text-lg font-semibold" data-testid="detector-result">
                    {verdict.correct ? "Correct! " : "Not quite. "}You played <NoteText midi={verdict.played} withOctave />.
                  </p>
                  {!verdict.correct && (
                    <p className="text-sm text-muted">
                      {mod12(verdict.played) === mod12(target)
                        ? `Right note name, wrong octave — go ${diff > 0 ? "down" : "up"} ${Math.abs(diff / 12)} octave${Math.abs(diff) > 12 ? "s" : ""}.`
                        : `That is ${Math.abs(diff)} semitone${Math.abs(diff) === 1 ? "" : "s"} ${diff > 0 ? "higher (to the right)" : "lower (to the left)"} than ${midiToName(target)}.`}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">Source: {verdict.source === "midi" ? "MIDI keyboard (exact)" : `microphone pitch estimate${verdict.cents !== undefined ? `, ${Math.round(verdict.cents)} cents from equal temperament` : ""}`}</p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Input" />
          <CardBody className="space-y-4">
            <MicButton status={mic.status} error={mic.error} onStart={() => void mic.start()} onStop={mic.stop} />
            <div className="border-t border-border pt-4">
              {midi.supported ? (
                midi.status === "connected" ? (
                  <p className="text-sm"><Badge tone="success">MIDI connected</Badge> {midi.devices.join(", ") || "Waiting for a device…"}</p>
                ) : (
                  <Button variant="secondary" onClick={() => void midi.connect()} loading={midi.status === "connecting"}><Piano className="h-4 w-4" /> Connect MIDI keyboard</Button>
                )
              ) : (
                <p className="text-xs text-muted">Web MIDI isn&apos;t supported in this browser (try Chrome or Edge on desktop).</p>
              )}
              {midi.error && <p className="mt-2 text-xs text-danger">{midi.error}</p>}
            </div>
          </CardBody>
        </Card>
        <Callout tone="warn" icon={<Info className="h-4 w-4" />} title="Microphone limits">
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Play <strong>one note at a time</strong>; chords confuse single-note detection.</li>
            <li>Piano notes are rich in overtones, so the mic occasionally hears the octave above. If the result is an octave off, play again a little softer.</li>
            <li>Very low notes (below about A1) and very high notes are unreliable.</li>
            <li>A <strong>MIDI keyboard</strong> gives exact results — use it when you can.</li>
          </ul>
        </Callout>
      </div>
    </div>
  );
}
