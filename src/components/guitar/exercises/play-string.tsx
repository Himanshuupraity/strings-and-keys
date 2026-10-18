"use client";
import { useT } from "@/lib/i18n";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Volume2 } from "lucide-react";
import { Fretboard } from "@/components/instruments/fretboard";
import { MicButton } from "@/components/instruments/mic-button";
import { Badge, Button, Callout, Select, SourceTag } from "@/components/ui";
import { useNoteInput, type NoteSource } from "@/hooks/use-note-input";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { usePrefs } from "@/hooks/use-prefs";
import { STANDARD_TUNING, stringNumber } from "@/lib/music/guitar";
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
  const tr = useT();
  const sl = (s: number) => tr(s === 0 ? "ui.string_label_low" : s === 5 ? "ui.string_label_high" : "ui.string_label", { n: stringNumber(s), note: midiToName(STANDARD_TUNING[s]) });
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
      a = { midi, cents, source, verdict: "correct", text: cents !== undefined ? tr("ui.ps_correct_cents", { note: midiToName(target), cents: `${cents > 0 ? "+" : ""}${Math.round(cents)}` }) : tr("ui.ps_correct", { note: midiToName(target) }) };
    } else if (diff === 0) {
      a = { midi, cents, source, verdict: "out-of-tune", text: tr(cents! > 0 ? "ui.ps_sharp" : "ui.ps_flat", { n: Math.round(Math.abs(cents!)) }) };
    } else if (Math.abs(diff) % 12 === 0) {
      a = { midi, cents, source, verdict: "wrong", text: tr(diff > 0 ? "ui.ps_octave_higher" : "ui.ps_octave_lower", { note: midiToName(midi) }) };
    } else {
      a = { midi, cents, source, verdict: "wrong", text: `${tr(diff > 0 ? "ui.ps_wrong_higher" : "ui.ps_wrong_lower", { note: midiToName(midi), n: Math.abs(diff), target: midiToName(target) })}${Math.abs(diff) <= 2 ? ` ${tr("ui.ps_or_retune")}` : ""}` };
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
          <span className="block font-medium">{tr("ui.target_string")}</span>
          <Select aria-label={tr("ui.target_string")} value={string} onChange={(e) => { setString(Number(e.target.value)); setAttempts([]); }}>
            {[5, 4, 3, 2, 1, 0].map((s) => <option key={s} value={s}>{sl(s)}</option>)}
          </Select>
        </label>
        <Button variant="secondary" onClick={() => void playReferenceTone(midiToFrequency(target, prefs.a4))}><Volume2 className="h-4 w-4" /> {tr("ui.hear_the_target")}</Button>
      </div>
      <p className="text-sm">
        {tr("ui.pluck_open_a")} <strong className="text-accent">{sl(string)}</strong> {tr("ui.pluck_open_b")}
      </p>
      <Fretboard frets={5} activeString={string} marks={[{ string, fret: 0, tone: "target" }]} onPlay={(p) => p.fret === 0 && judge(p.midi, "virtual")} />
      <MicButton status={mic.status} error={mic.error} onStart={mic.start} onStop={mic.stop} label={tr("ui.listen_to_my_guitar")} />
      {mic.listening && (
        <p className="text-xs text-muted" aria-live="polite">
          {tr("ui.live_label")} {mic.pitch?.note ? `${mic.pitch.note.name} ${mic.pitch.note.cents > 0 ? "+" : ""}${Math.round(mic.pitch.note.cents)}¢` : mic.pitch && mic.pitch.level > 0.01 ? tr("ui.sound_pitch_unclear") : tr("ui.waiting_clear_note_lc")}
        </p>
      )}
      {!mic.listening && <p className="text-xs text-muted">{tr("ui.no_microphone_tap_the_open_string_on_the_virtual")}</p>}
      {last && (
        <Callout tone={last.verdict === "correct" ? "success" : last.verdict === "out-of-tune" ? "warn" : "danger"} icon={last.verdict === "correct" ? <Check className="h-4 w-4" /> : last.cents && last.cents > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}>
          <span className="text-text">{last.text}</span> <SourceTag source="measured" /> <Badge>{last.source === "mic" ? tr("ui.microphone") : tr("ui.virtual_neck")}</Badge>
        </Callout>
      )}
      <p className="text-xs text-muted">{tr("ui.the_microphone_measures_pitch_only_it_can_t_see")}</p>
    </div>
  );
}
