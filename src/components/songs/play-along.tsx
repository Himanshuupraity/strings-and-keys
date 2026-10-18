"use client";

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
      if (r.verdict === "correct") setLast({ ok: true, text: `${midiToName(midi)} — correct` });
      else if (r.verdict === "wrong" && r.expected !== undefined) {
        const diff = mod12(midi - r.expected);
        const dir = diff <= 6 ? `${diff} semitone${diff === 1 ? "" : "s"} too high` : `${12 - diff} semitone${12 - diff === 1 ? "" : "s"} too low`;
        setLast({ ok: false, text: `You played ${midiToName(midi)}; the note is ${midiToName(r.expected)} (${dir}).` });
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
      setLast({ ok: false, text: "Press Play first — play-along judges your notes against the music as it plays." });
      return;
    }
    if (hasMelody) {
      const r = judgeMelodyHit(timeline, b, midi);
      setStats((s) => (r.correct ? { ...s, hits: s.hits + 1 } : { ...s, misses: s.misses + 1 }));
      setLast(r.correct ? { ok: true, text: `${midiToName(midi)} — right note, in time` } : { ok: false, text: r.expected !== null ? `Expected ${midiToName(r.expected)} around now, heard ${midiToName(midi)}.` : `No melody note right now (heard ${midiToName(midi)}).` });
    } else {
      const c = chordAt(timeline, b).current;
      const ok = !!c && chordPitchClasses(c.chord).includes(mod12(midi));
      setStats((s) => (ok ? { ...s, hits: s.hits + 1 } : { ...s, misses: s.misses + 1 }));
      setLast(ok ? { ok: true, text: `${midiToName(midi)} belongs to ${c!.chord}` } : { ok: false, text: c ? `${midiToName(midi)} isn't in ${c.chord} (${chordPitchClasses(c.chord).map((p) => midiToName(60 + p).slice(0, -1)).join(" ")})` : "Between chords" });
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
          label="Practice mode"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setLast(null);
          }}
          options={[
            ...(hasMelody ? [{ value: "wait" as Mode, label: "Step-by-step (no timer)" }] : []),
            { value: "along", label: hasMelody ? "Play along in time" : "Play chord tones in time" },
          ]}
        />
        <SourceTag source="measured" />
      </div>

      {mode === "wait" && hasMelody && (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            The next melody note glows orange. Play it — on screen, a MIDI keyboard, or your instrument with the microphone. Any octave counts. Take your time: there’s no timer.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge tone="accent">
              Note {Math.min(seq.index + 1, melody.length)} / {melody.length}
            </Badge>
            {target !== undefined && <span>Next: <strong>{midiToName(target)}</strong></span>}
            <Button size="sm" variant="ghost" onClick={() => { setSeq(startSequence(melody, true)); setSaved(false); setLast(null); }}>
              <RotateCcw className="h-4 w-4" /> Restart
            </Button>
          </div>
          {seq.done && (
            <Callout tone="success" title={`Melody complete — ${Math.round(sequenceAccuracy(seq) * 100)}% right first time`}>
              {mistakeSummary(seq, (m) => midiToName(m)) ?? "No mistakes. Try play-along mode next to add timing."} Result saved to your progress.
            </Callout>
          )}
        </div>
      )}

      {mode === "along" && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p className="text-muted">{hasMelody ? "Press Play above, then play the melody notes as they come." : "Press Play above, then play any note of the current chord (or strum it on a real guitar with the mic)."}</p>
          <Badge tone="success">{stats.hits} hits</Badge>
          <Badge tone="danger">{stats.misses} misses</Badge>
          {acc !== null && <Badge>{Math.round(acc * 100)}% accuracy</Badge>}
          <Button size="sm" variant="ghost" onClick={() => setStats({ hits: 0, misses: 0 })}>Reset</Button>
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
          <p className="mb-2 text-sm font-medium">MIDI keyboard</p>
          {!midi.supported ? (
            <p className="text-xs text-muted">Web MIDI isn’t available in this browser (try Chrome or Edge on desktop).</p>
          ) : midi.status === "connected" ? (
            <p className="text-xs text-success">{midi.devices.length ? `Connected: ${midi.devices.join(", ")}` : "Waiting for a device…"}</p>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void midi.connect()}>Connect MIDI</Button>
          )}
          {midi.error && <p className="mt-1 text-xs text-danger">{midi.error}</p>}
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-sm font-medium">Real instrument (microphone)</p>
          <MicButton status={mic.status} error={mic.error} onStart={() => void mic.start()} onStop={mic.stop} label="Listen to me" />
          <p className="mt-1 text-xs text-muted">Best for single melody notes played clearly. Chords and noisy rooms can’t be judged reliably by the mic.</p>
          {mic.listening && mic.pitch?.note && <p className="mt-1 text-xs">Hearing: <strong>{mic.pitch.note.name}</strong>{mic.pitch.stable ? "" : " (unstable)"}</p>}
        </div>
      </div>
    </div>
  );
}
