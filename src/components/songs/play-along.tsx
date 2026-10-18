"use client";
import { useT, useTm } from "@/lib/i18n";

import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { PianoKeyboard, type KeyTone } from "@/components/instruments/piano-keyboard";
import { Fretboard, type FretMark } from "@/components/instruments/fretboard";
import { MicButton } from "@/components/instruments/mic-button";
import { Badge, Button, Callout, Segmented, SourceTag, cn } from "@/components/ui";
import { useNoteInput, type NoteSource } from "@/hooks/use-note-input";
import { chordMidi, chordPitchClasses, easiestShape } from "@/lib/music/chords";
import { positionsOfMidi } from "@/lib/music/guitar";
import { midiToName, mod12 } from "@/lib/music/notes";
import { startSequence, stepSequence, sequenceAccuracy, mistakeSummary } from "@/lib/exercises/sequence";
import { exerciseRepo } from "@/lib/storage/repositories";
import { chordAt, judgeMelodyHit, noteAt, type Timeline } from "./playback";

interface Props {
  songId: string;
  timeline: Timeline;
  instrument: "guitar" | "piano";
  playing: boolean;
  beat: number | null;
  beatNow: () => number | null;
  onPing: () => void;
}

type Mode = "wait" | "along";

/**
 * Student plays along on the virtual instrument, a MIDI keyboard or (for single melody notes) the
 * microphone. Results are MEASURED pitch comparisons — timing is judged only in play-along mode,
 * and technique (fingering, finger pressure) is never claimed.
 */
export function PlayAlong({ songId, timeline, instrument, playing, beat, beatNow, onPing }: Props) {
  const tr = useT();
  const tm = useTm();
  const melody = useMemo(() => timeline.notes.filter((n) => n.midi !== null).map((n) => n.midi!), [timeline]);
  const hasMelody = melody.length > 0;
  const [mode, setMode] = useState<Mode>(hasMelody ? "wait" : "along");
  const [seq, setSeq] = useState(() => startSequence(melody, true));
  const [stats, setStats] = useState({ hits: 0, misses: 0 });
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [seqKey, setSeqKey] = useState(timeline);
  if (seqKey !== timeline) {
    setSeqKey(timeline);
    setSeq(startSequence(melody, true));
    setSaved(false);
  }

  const handle = (midi: number, source: NoteSource) => {
    onPing();
    if (mode === "wait") {
      if (!hasMelody || seq.done) return;
      const r = stepSequence(seq, midi);
      setSeq(r.state);
      if (r.verdict === "correct") setLast({ ok: true, text: tr("ui.pa_correct", { note: midiToName(midi) }) });
      else if (r.verdict === "wrong" && r.expected !== undefined) {
        const diff = mod12(midi - r.expected);
        const n = diff <= 6 ? diff : 12 - diff;
        setLast({ ok: false, text: tm({ key: diff <= 6 ? "ui.pa_too_high" : "ui.pa_too_low", vars: { note: midiToName(midi), target: midiToName(r.expected), semis: { key: n === 1 ? "unit.semitone.one" : "unit.semitone.many", vars: { n } } } }) });
      }
      if (r.state.done && !saved) {
        setSaved(true);
        const acc = sequenceAccuracy(r.state);
        void exerciseRepo.add({ instrument, exerciseId: `song:${songId}:melody`, skill: "song-melody", input: source === "mic" ? "mic" : source === "midi" ? "midi" : "virtual", correct: Math.round(acc * melody.length), total: melody.length, accuracy: acc, measured: true });
      }
      return;
    }
    // Play-along: judge against the song position right now.
    const b = beatNow();
    if (!playing || b === null) {
      setLast({ ok: false, text: tr("ui.press_play_first_play_along_judges_your_notes_ag") });
      return;
    }
    if (hasMelody) {
      const r = judgeMelodyHit(timeline, b, midi);
      setStats((s) => (r.correct ? { ...s, hits: s.hits + 1 } : { ...s, misses: s.misses + 1 }));
      setLast(r.correct ? { ok: true, text: tr("ui.pa_right_in_time", { note: midiToName(midi) }) } : { ok: false, text: r.expected !== null ? tr("ui.pa_expected_heard", { exp: midiToName(r.expected), heard: midiToName(midi) }) : tr("ui.pa_no_melody_now", { heard: midiToName(midi) }) });
    } else {
      const c = chordAt(timeline, b).current;
      const ok = !!c && chordPitchClasses(c.chord).includes(mod12(midi));
      setStats((s) => (ok ? { ...s, hits: s.hits + 1 } : { ...s, misses: s.misses + 1 }));
      setLast(ok ? { ok: true, text: tr("ui.pa_belongs", { note: midiToName(midi), chord: c!.chord }) } : { ok: false, text: c ? tr("ui.pa_not_in", { note: midiToName(midi), chord: c.chord, notes: chordPitchClasses(c.chord).map((p) => midiToName(60 + p).slice(0, -1)).join(" ") }) : tr("ui.between_chords") });
    }
  };

  const { midi, mic } = useNoteInput((m, src) => handle(m, src));

  // What to highlight.
  const position = playing && beat !== null ? beat : null;
  const currentChord = position !== null ? chordAt(timeline, position).current : timeline.chords[0];
  const target = mode === "wait" ? (seq.done ? undefined : seq.targets[seq.index]) : position !== null ? noteAt(timeline, position)?.midi ?? undefined : undefined;

  const range = useMemo(() => {
    const all = [...melody, ...(timeline.chords[0] ? chordMidi(timeline.chords[0].chord, 4) : [60])];
    const lo = Math.min(48, Math.floor(Math.min(...all) / 12) * 12);
    const hi = Math.max(lo + 24, Math.ceil((Math.max(...all) + 1) / 12) * 12);
    return { lo, hi: Math.min(hi, 96) };
  }, [melody, timeline]);

  const highlight: Partial<Record<number, KeyTone>> = {};
  if (currentChord) for (const m of chordMidi(currentChord.chord, 3)) highlight[m] = "chord";
  if (target !== undefined) highlight[target] = "target";

  const marks: FretMark[] = [];
  const shape = currentChord ? easiestShape(currentChord.chord) : undefined;
  if (shape && (mode === "along" || !hasMelody)) shape.frets.forEach((f, s) => f > 0 && marks.push({ string: s, fret: f, tone: "chord", finger: shape.fingers[s] > 0 ? shape.fingers[s] : undefined }));
  if (target !== undefined) {
    const pos = positionsOfMidi(target < 40 ? target + 12 : target, 12).sort((a, b) => a.fret - b.fret)[0];
    if (pos) marks.push({ string: pos.string, fret: pos.fret, tone: "target" });
  }

  const acc = stats.hits + stats.misses ? stats.hits / (stats.hits + stats.misses) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Mode>
          label={tr("ui.practice_mode")}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setLast(null);
          }}
          options={[
            ...(hasMelody ? [{ value: "wait" as Mode, label: tr("ui.step_by_step_no_timer") }] : []),
            { value: "along", label: hasMelody ? tr("ui.play_along_in_time") : tr("ui.play_chord_tones_in_time") },
          ]}
        />
        <SourceTag source="measured" />
      </div>

      {mode === "wait" && hasMelody && (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            {tr("ui.the_next_melody_note_glows_orange_play_it_on_scr")}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge tone="accent">
              Note {Math.min(seq.index + 1, melody.length)} / {melody.length}
            </Badge>
            {target !== undefined && <span>{tr("ui.next")} <strong>{midiToName(target)}</strong></span>}
            <Button size="sm" variant="ghost" onClick={() => { setSeq(startSequence(melody, true)); setSaved(false); setLast(null); }}>
              <RotateCcw className="h-4 w-4" /> {tr("ui.restart")}
            </Button>
          </div>
          {seq.done && (
            <Callout tone="success" title={`Melody complete — ${Math.round(sequenceAccuracy(seq) * 100)}% right first time`}>
              {mistakeSummary(seq, (m) => midiToName(m)) ?? tr("ui.no_mistakes_try_play_along_mode_next_to_add_timi")} Result saved to your progress.
            </Callout>
          )}
        </div>
      )}

      {mode === "along" && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p className="text-muted">{hasMelody ? tr("ui.press_play_above_then_play_the_melody_notes_as_t") : tr("ui.press_play_above_then_play_any_note_of_the_curre")}</p>
          <Badge tone="success">{stats.hits} hits</Badge>
          <Badge tone="danger">{stats.misses} misses</Badge>
          {acc !== null && <Badge>{Math.round(acc * 100)}% accuracy</Badge>}
          <Button size="sm" variant="ghost" onClick={() => setStats({ hits: 0, misses: 0 })}>{tr("ui.reset")}</Button>
        </div>
      )}

      <div aria-live="polite" className="min-h-6 text-sm">
        {last && (
          <span className={cn("inline-flex items-center gap-1.5", last.ok ? "text-success" : "text-danger")}>
            {last.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {last.text}
          </span>
        )}
      </div>

      {instrument === "piano" ? (
        <PianoKeyboard low={range.lo} high={range.hi} highlight={highlight} pressed={midi.held} onNoteOn={(m) => handle(m, "virtual")} whiteKeyWidth={38} height={160} focusMidi={target ?? 60} computerKeyboard />
      ) : (
        <Fretboard frets={12} marks={marks} onPlay={(p) => handle(p.midi, "virtual")} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-sm font-medium">{tr("ui.midi_keyboard")}</p>
          {!midi.supported ? (
            <p className="text-xs text-muted">{tr("ui.web_midi_isn_t_available_in_this_browser_try_chr")}</p>
          ) : midi.status === "connected" ? (
            <p className="text-xs text-success">{midi.devices.length ? `Connected: ${midi.devices.join(", ")}` : tr("ui.waiting_for_a_device")}</p>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void midi.connect()}>{tr("ui.connect_midi")}</Button>
          )}
          {midi.error && <p className="mt-1 text-xs text-danger">{midi.error}</p>}
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-sm font-medium">{tr("ui.real_instrument_microphone")}</p>
          <MicButton status={mic.status} error={mic.error} onStart={() => void mic.start()} onStop={mic.stop} label={tr("ui.listen_to_me")} />
          <p className="mt-1 text-xs text-muted">{tr("ui.best_for_single_melody_notes_played_clearly_chor")}</p>
          {mic.listening && mic.pitch?.note && <p className="mt-1 text-xs">{tr("ui.hearing")} <strong>{mic.pitch.note.name}</strong>{mic.pitch.stable ? "" : " (unstable)"}</p>}
        </div>
      </div>
    </div>
  );
}
