"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Volume2 } from "lucide-react";
import { Fretboard } from "@/components/instruments/fretboard";
import { MicButton } from "@/components/instruments/mic-button";
import { Badge, Button, Callout, Select, SourceTag } from "@/components/ui";
import { useNoteInput, type NoteSource } from "@/hooks/use-note-input";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { usePrefs } from "@/hooks/use-prefs";
import { STANDARD_TUNING, stringLabel } from "@/lib/music/guitar";
import { midiToFrequency, midiToName } from "@/lib/music/notes";
import { saveGuitarResult } from "./shared";
import { playReferenceTone } from "../reference-tone";

interface Attempt {
  midi: number;
  cents?: number;
  source: NoteSource;
  verdict: "correct" | "out-of-tune" | "wrong";
  text: string;
}

/** Pluck one open string; the mic measures pitch and compares it with the target. */
export function PlayOneString() {
  const [prefs] = usePrefs();
  const [string, setString] = useState(5);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const { ping } = usePracticeLog("Guitar exercise: single string", { instrument: "guitar" });
  const target = STANDARD_TUNING[string];

  const judge = (midi: number, source: NoteSource, cents?: number) => {
    ping();
    const diff = midi - target;
    let a: Attempt;
    if (diff === 0 && (cents === undefined || Math.abs(cents) <= 25)) {
      a = { midi, cents, source, verdict: "correct", text: `That's ${midiToName(target)} — exactly the target${cents !== undefined ? ` (${cents > 0 ? "+" : ""}${Math.round(cents)} cents)` : ""}. Well done!` };
    } else if (diff === 0) {
      a = { midi, cents, source, verdict: "out-of-tune", text: `Right note, but ${Math.round(Math.abs(cents!))} cents ${cents! > 0 ? "sharp (a little high)" : "flat (a little low)"}. Use the tuner to fix the string's tuning.` };
    } else if (Math.abs(diff) % 12 === 0) {
      a = { midi, cents, source, verdict: "wrong", text: `The microphone heard ${midiToName(midi)} — same note name, one octave ${diff > 0 ? "higher" : "lower"}. This can be an overtone; pluck once more, a bit softer, and let it ring.` };
    } else {
      a = { midi, cents, source, verdict: "wrong", text: `Heard ${midiToName(midi)}, which is ${Math.abs(diff)} semitone${Math.abs(diff) === 1 ? "" : "s"} ${diff > 0 ? "higher" : "lower"} than ${midiToName(target)}. Check you're plucking the right string with no finger on it${Math.abs(diff) <= 2 ? ", or retune it" : ""}.` };
    }
    if (a.verdict === "correct") {
      void saveGuitarResult({ exerciseId: `guitar-single-string-${string}`, skill: "single-string", input: source === "mic" ? "mic" : "virtual", correct: 1, total: attempts.length + 1, measured: true, details: `target ${midiToName(target)}` });
    }
    setAttempts((xs) => [a, ...xs].slice(0, 6));
  };

  const { mic } = useNoteInput((midi, source, detail) => {
    if (source === "mic") judge(midi, "mic", detail?.note?.cents);
  });

  const last = attempts[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Target string</span>
          <Select aria-label="Target string" value={string} onChange={(e) => { setString(Number(e.target.value)); setAttempts([]); }}>
            {[5, 4, 3, 2, 1, 0].map((s) => <option key={s} value={s}>{stringLabel(s)}</option>)}
          </Select>
        </label>
        <Button variant="secondary" onClick={() => void playReferenceTone(midiToFrequency(target, prefs.a4))}><Volume2 className="h-4 w-4" /> Hear the target</Button>
      </div>
      <p className="text-sm">
        Pluck the open <strong className="text-accent">{stringLabel(string)}</strong> once and let it ring. No fingers on the frets.
      </p>
      <Fretboard frets={5} activeString={string} marks={[{ string, fret: 0, tone: "target" }]} onPlay={(p) => p.fret === 0 && judge(p.midi, "virtual")} />
      <MicButton status={mic.status} error={mic.error} onStart={mic.start} onStop={mic.stop} label="Listen to my guitar" />
      {mic.listening && (
        <p className="text-xs text-muted" aria-live="polite">
          Live: {mic.pitch?.note ? `${mic.pitch.note.name} ${mic.pitch.note.cents > 0 ? "+" : ""}${Math.round(mic.pitch.note.cents)}¢` : mic.pitch && mic.pitch.level > 0.01 ? "sound detected, pitch unclear — pluck again clearly" : "waiting for a clear note…"}
        </p>
      )}
      {!mic.listening && <p className="text-xs text-muted">No microphone? Tap the open string on the virtual neck instead (that checks you picked the right string, not your real guitar).</p>}
      {last && (
        <Callout tone={last.verdict === "correct" ? "success" : last.verdict === "out-of-tune" ? "warn" : "danger"} icon={last.verdict === "correct" ? <Check className="h-4 w-4" /> : last.cents && last.cents > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}>
          <span className="text-text">{last.text}</span> <SourceTag source="measured" /> <Badge>{last.source === "mic" ? "microphone" : "virtual neck"}</Badge>
        </Callout>
      )}
      <p className="text-xs text-muted">The microphone measures pitch only. It can&apos;t see whether another string buzzed or how you held the pick.</p>
    </div>
  );
}
