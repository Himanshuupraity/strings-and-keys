"use client";
import { useT } from "@/lib/i18n";

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
  const tr = useT();
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
          <CardHeader title={tr("ui.target_note")} description={tr("ui.pick_a_key_below_or_press_new_target_then_play_t")} action={<Badge tone="piano">{score.right}/{score.total} correct</Badge>} />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="font-display text-6xl" data-testid="detector-target"><NoteText midi={target} withOctave /></div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => void playPianoNote(target, 1)}><Volume2 className="h-4 w-4" /> {tr("ui.hear_it")}</Button>
                <Button variant="secondary" size="sm" onClick={newTarget}><RotateCcw className="h-4 w-4" /> {tr("ui.new_target")}</Button>
              </div>
            </div>
            <PianoKeyboard low={48} high={84} highlight={{ [target]: "target", ...(verdict && !verdict.correct ? { [verdict.played]: "wrong" as const } : {}), ...(verdict?.correct ? { [target]: "correct" as const } : {}) }} pressed={midi.held} onNoteOn={(m) => { setTarget(m); setVerdict(null); }} labels="white" focusMidi={66} whiteKeyWidth={38} height={150} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={tr("ui.what_i_heard")} action={verdict && <SourceTag source="measured" />} />
          <CardBody aria-live="polite">
            {!verdict ? (
              <p className="text-muted">{mic.listening || midi.status === "connected" ? tr("ui.play_one_note_and_hold_it_for_a_moment") : tr("ui.start_listening_with_the_microphone_or_connect_a")}</p>
            ) : (
              <div className={cn("flex items-start gap-3 rounded-xl p-4", verdict.correct ? "bg-success-soft" : "bg-danger-soft")}>
                {verdict.correct ? <CheckCircle2 className="mt-0.5 h-6 w-6 text-success" /> : <XCircle className="mt-0.5 h-6 w-6 text-danger" />}
                <div>
                  <p className="text-lg font-semibold" data-testid="detector-result">
                    {tr(verdict.correct ? "ui.correct_you_played" : "ui.not_quite_you_played")} <NoteText midi={verdict.played} withOctave />.
                  </p>
                  {!verdict.correct && (
                    <p className="text-sm text-muted">
                      {mod12(verdict.played) === mod12(target)
                        ? tr(diff > 0 ? "ui.wrong_octave_down" : "ui.wrong_octave_up", { n: Math.abs(diff / 12) })
                        : tr(diff > 0 ? "ui.semis_higher_right" : "ui.semis_lower_left", { n: Math.abs(diff), note: midiToName(target) })}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">Source: {verdict.source === "midi" ? tr("ui.midi_keyboard_exact") : `microphone pitch estimate${verdict.cents !== undefined ? `, ${Math.round(verdict.cents)} cents from equal temperament` : ""}`}</p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title={tr("ui.input")} />
          <CardBody className="space-y-4">
            <MicButton status={mic.status} error={mic.error} onStart={() => void mic.start()} onStop={mic.stop} />
            <div className="border-t border-border pt-4">
              {midi.supported ? (
                midi.status === "connected" ? (
                  <p className="text-sm"><Badge tone="success">{tr("ui.midi_connected")}</Badge> {midi.devices.join(", ") || tr("ui.waiting_for_a_device")}</p>
                ) : (
                  <Button variant="secondary" onClick={() => void midi.connect()} loading={midi.status === "connecting"}><Piano className="h-4 w-4" /> {tr("ui.connect_midi_keyboard")}</Button>
                )
              ) : (
                <p className="text-xs text-muted">{tr("ui.web_midi_isn_t_supported_in_this_browser_try_chr")}</p>
              )}
              {midi.error && <p className="mt-2 text-xs text-danger">{midi.error}</p>}
            </div>
          </CardBody>
        </Card>
        <Callout tone="warn" icon={<Info className="h-4 w-4" />} title={tr("ui.microphone_limits")}>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>{tr("ui.one_note_at_a_time_li")}</li>
            <li>{tr("ui.piano_notes_are_rich_in_overtones_so_the_mic_occ")}</li>
            <li>{tr("ui.very_low_notes_below_about_a1_and_very_high_note")}</li>
            <li>A <strong>{tr("ui.midi_keyboard")}</strong> {tr("ui.gives_exact_results_use_it_when_you_can")}</li>
          </ul>
        </Callout>
      </div>
    </div>
  );
}
