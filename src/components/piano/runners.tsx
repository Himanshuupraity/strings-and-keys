"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Ear, Eraser, Headphones, Lightbulb, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { Badge, Button, Callout, ProgressBar, Slider, SourceTag, cn } from "@/components/ui";
import { Staff } from "@/components/instruments/staff";
import { NoteText } from "@/components/instruments/note-label";
import type { KeyTone } from "@/components/instruments/piano-keyboard";
import { ensureAudio, playPianoChord, playPianoNote } from "@/lib/audio/engine";
import { compareChordTones } from "@/lib/music/chords";
import { midiToName, mod12, pcName } from "@/lib/music/notes";
import { findAllProgress, mistakeSummary, sequenceAccuracy, startSequence, stepSequence, type SequenceState } from "@/lib/exercises/sequence";
import { exerciseRepo } from "@/lib/storage/repositories";
import { clefFor, type PianoExerciseDef, type ResolvedExercise } from "./exercises";
import { LabKeyboard, useLabMidi } from "./lab-context";

type Source = "virtual" | "midi";

/* ---------------- shared helpers ---------------- */

async function saveResult(def: PianoExerciseDef, suffix: string, source: Source, correct: number, total: number, details?: string) {
  const accuracy = total ? Math.max(0, Math.min(1, correct / total)) : 1;
  try {
    await exerciseRepo.add({
      instrument: "piano",
      exerciseId: def.id + suffix,
      skill: def.skill,
      input: source,
      correct,
      total,
      accuracy,
      measured: true,
      details,
    });
    toast.success(`Saved: ${Math.round(accuracy * 100)}% on first try`, { description: `${def.title} — measured from your ${source === "midi" ? "MIDI keyboard" : "on-screen key presses"}.` });
  } catch {
    toast.error("Couldn't save this result, but you can keep practising.");
  }
}

/** Short-lived key colour after each answer. */
function useFlash() {
  const [flash, setFlash] = useState<Partial<Record<number, KeyTone>>>({});
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const show = (midi: number, tone: KeyTone, ms = 450) => {
    setFlash((f) => ({ ...f, [midi]: tone }));
    timers.current.push(
      window.setTimeout(() => {
        setFlash((f) => {
          const n = { ...f };
          delete n[midi];
          return n;
        });
      }, ms),
    );
  };
  return { flash, show };
}

function DoneCard({ accuracy, correct, total, source, note, onRetry, children }: { accuracy: number; correct: number; total: number; source: Source; note?: string | null; onRetry: () => void; children?: React.ReactNode }) {
  const great = accuracy >= 0.8;
  return (
    <div className={cn("animate-pop rounded-2xl border p-4", great ? "border-transparent bg-success-soft" : "border-border bg-surface-2")} role="status">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className={cn("h-5 w-5", great ? "text-success" : "text-muted")} aria-hidden />
        <p className="font-semibold">
          {great ? "Lovely — exercise complete!" : "Done! Let's tidy it up next time."} {Math.round(accuracy * 100)}% right on the first try ({correct}/{total})
        </p>
        <SourceTag source="measured" />
        <Badge>{source === "midi" ? "MIDI input" : "On-screen keys"}</Badge>
      </div>
      {note && <p className="mt-2 text-sm text-muted">{note}</p>}
      {!great && <p className="mt-1 text-sm text-muted">Tip: slow down. Accuracy first — speed comes by itself.</p>}
      {children}
      <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry}>
        <RotateCcw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}

const beats = (d?: string) => (d === "w" ? 4 : d === "h" ? 2 : d === "8" ? 0.5 : 1);

/* ---------------- Sequence (incl. middle C, scales, melodies, staff reading, sargam) ---------------- */

export function SequenceRunner({ def, res, suffix, hideLabels, showStaff, chipMode }: { def: PianoExerciseDef; res: ResolvedExercise; suffix: string; hideLabels?: boolean; showStaff?: boolean; chipMode?: "both" }) {
  const [seq, setSeq] = useState<SequenceState>(() => startSequence(res.targets));
  const seqRef = useRef(seq);
  const usedMidi = useRef(false);
  const [midiUsed, setMidiUsed] = useState(false);
  const { flash, show } = useFlash();
  const [bpm, setBpm] = useState(72);
  const [demoIdx, setDemoIdx] = useState<number | null>(null);
  const demoTimers = useRef<number[]>([]);
  useEffect(() => () => demoTimers.current.forEach(clearTimeout), []);

  const handle = (midi: number, source: Source) => {
    if (source === "midi") {
      usedMidi.current = true;
      setMidiUsed(true);
    }
    const r = stepSequence(seqRef.current, midi);
    if (r.verdict === "ignored") return;
    seqRef.current = r.state;
    setSeq(r.state);
    show(midi, r.verdict === "correct" ? "correct" : "wrong");
    if (r.state.done) {
      const correct = r.state.wrongBefore.filter((w) => w === 0).length;
      void saveResult(def, suffix, usedMidi.current ? "midi" : "virtual", correct, r.state.targets.length, mistakeSummary(r.state, (m) => midiToName(m)) ?? undefined);
    }
  };
  useLabMidi((e) => e.type === "on" && handle(e.midi, "midi"));

  const retry = () => {
    const s = startSequence(res.targets);
    seqRef.current = s;
    usedMidi.current = false;
    setMidiUsed(false);
    setSeq(s);
  };

  const stopDemo = () => {
    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
    setDemoIdx(null);
  };
  const listen = async () => {
    stopDemo();
    await ensureAudio();
    const beat = 60 / bpm;
    let t = 0;
    res.targets.forEach((m, i) => {
      const len = beats(res.durations?.[i]) * beat;
      void playPianoNote(m, len * 0.9, t);
      demoTimers.current.push(window.setTimeout(() => setDemoIdx(i), t * 1000));
      t += len;
    });
    demoTimers.current.push(window.setTimeout(() => setDemoIdx(null), t * 1000 + 200));
  };

  const next = seq.done ? undefined : res.targets[seq.index];
  const highlight: Partial<Record<number, KeyTone>> = {};
  if (demoIdx !== null) highlight[res.targets[demoIdx]] = "hint";
  else if (next !== undefined) highlight[next] = "target";
  Object.assign(highlight, flash);
  const fingers = next !== undefined && res.fingers ? { [next]: res.fingers[seq.index] } : demoIdx !== null && res.fingers ? { [res.targets[demoIdx]]: res.fingers[demoIdx] } : undefined;

  const accuracy = sequenceAccuracy(seq);
  const staffNotes = res.targets.map((m, i) => ({ note: midiToName(m), duration: res.durations?.[i] ?? ("q" as const), label: res.fingers ? String(res.fingers[i]) : undefined }));
  const states = res.targets.map((_, i) => (i < seq.index ? (seq.wrongBefore[i] === 0 ? ("correct" as const) : ("wrong" as const)) : undefined));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="secondary" onClick={demoIdx !== null ? stopDemo : listen} data-testid="exercise-listen">
          {demoIdx !== null ? <Square className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
          {demoIdx !== null ? "Stop" : "Listen first"}
        </Button>
        <Slider className="w-48" label="Demo tempo" value={bpm} min={40} max={160} step={4} onChange={setBpm} format={(v) => `${v} BPM`} />
        <div className="ml-auto min-w-40 flex-1 sm:max-w-xs">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>
              Note {Math.min(seq.index + 1, res.targets.length)} of {res.targets.length}
            </span>
            {seq.mistakes.length > 0 && <span>{seq.mistakes.length} slip{seq.mistakes.length > 1 ? "s" : ""}</span>}
          </div>
          <ProgressBar value={seq.index / Math.max(1, res.targets.length)} tone="piano" label="Exercise progress" />
        </div>
      </div>

      {showStaff && <Staff clef={clefFor(res.targets)} notes={staffNotes} highlightIndex={seq.done ? undefined : demoIdx ?? seq.index} states={states} />}

      {!hideLabels && (
        <ol className="flex flex-wrap gap-1.5" aria-label="Notes to play">
          {res.targets.map((m, i) => (
            <li
              key={i}
              className={cn(
                "flex min-w-10 flex-col items-center rounded-lg border px-2 py-1 text-sm",
                i === seq.index && !seq.done ? "border-accent bg-accent-soft font-semibold text-accent" : i < seq.index ? (seq.wrongBefore[i] ? "border-transparent bg-warn-soft" : "border-transparent bg-success-soft") : "border-border bg-surface",
              )}
              aria-current={i === seq.index ? "step" : undefined}
            >
              <NoteText midi={m} mode={chipMode} />
              {res.fingers && <span className="text-[10px] text-muted">finger {res.fingers[i]}</span>}
            </li>
          ))}
        </ol>
      )}

      {seq.done ? (
        <DoneCard accuracy={accuracy} correct={seq.wrongBefore.filter((w) => w === 0).length} total={res.targets.length} source={midiUsed ? "midi" : "virtual"} note={mistakeSummary(seq, (m) => midiToName(m))} onRetry={retry} />
      ) : (
        seq.mistakes.length > 0 &&
        seq.mistakes[seq.mistakes.length - 1].at === seq.index && (
          <p className="text-sm text-warn" role="status" aria-live="polite">
            Not quite — you played {midiToName(seq.mistakes[seq.mistakes.length - 1].played)}. Look for the glowing key{hideLabels ? " and check the staff" : ""}.
          </p>
        )
      )}

      <LabKeyboard highlight={highlight} fingers={fingers} hideLabels={hideLabels} onNoteOn={(m) => handle(m, "virtual")} ariaLabel={`Piano keyboard for exercise: ${def.title}`} />
    </div>
  );
}

/* ---------------- Find all ---------------- */

export function FindAllRunner({ def, low, high }: { def: Extract<PianoExerciseDef, { kind: "find-all" }>; low: number; high: number }) {
  const [clicked, setClicked] = useState<number[]>([]);
  const clickedRef = useRef<number[]>([]);
  const usedMidi = useRef(false);
  const [midiUsed, setMidiUsed] = useState(false);
  const savedRef = useRef(false);
  const [hint, setHint] = useState(false);
  const { flash, show } = useFlash();
  const candidates = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const progress = findAllProgress(candidates, clicked, def.pitchClass);

  const handle = (midi: number, source: Source) => {
    if (source === "midi") {
      usedMidi.current = true;
      setMidiUsed(true);
    }
    if (clickedRef.current.includes(midi) || savedRef.current) return;
    const next = [...clickedRef.current, midi];
    clickedRef.current = next;
    setClicked(next);
    const ok = mod12(midi) === def.pitchClass;
    show(midi, ok ? "correct" : "wrong", ok ? 300 : 700);
    const p = findAllProgress(candidates, next, def.pitchClass);
    if (p.done) {
      savedRef.current = true;
      void saveResult(def, "", usedMidi.current ? "midi" : "virtual", Math.round(p.accuracy * p.targets.length), p.targets.length, p.wrong.length ? `${p.wrong.length} wrong key${p.wrong.length > 1 ? "s" : ""} clicked` : undefined);
    }
  };
  useLabMidi((e) => e.type === "on" && handle(e.midi, "midi"));

  const highlight: Partial<Record<number, KeyTone>> = {};
  for (const f of progress.found) highlight[f] = "correct";
  if (hint) for (const t of progress.targets) if (!progress.found.includes(t)) highlight[t] = "hint";
  Object.assign(highlight, flash);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="piano">
          Found {progress.found.length} of {progress.targets.length} {pcName(def.pitchClass)}s
        </Badge>
        {progress.wrong.length > 0 && <Badge tone="warn">{progress.wrong.length} wrong</Badge>}
        <Button size="sm" variant="ghost" onClick={() => setHint((h) => !h)} aria-pressed={hint}>
          <Lightbulb className="h-4 w-4" /> {hint ? "Hide hint" : "Show remaining"}
        </Button>
      </div>
      {progress.done && (
        <DoneCard
          accuracy={progress.accuracy}
          correct={Math.round(progress.accuracy * progress.targets.length)}
          total={progress.targets.length}
          source={midiUsed ? "midi" : "virtual"}
          note={hint ? "You used the hint this time — try once more without it." : null}
          onRetry={() => {
            clickedRef.current = [];
            savedRef.current = false;
            usedMidi.current = false;
            setMidiUsed(false);
    setMidiUsed(false);
            setClicked([]);
            setHint(false);
          }}
        />
      )}
      <LabKeyboard highlight={highlight} hideLabels onNoteOn={(m) => handle(m, "virtual")} ariaLabel="Piano keyboard: find every C (labels hidden)" />
      <p className="text-xs text-muted">Labels are hidden so you learn the pattern: C sits just left of every group of two black keys.</p>
    </div>
  );
}

/* ---------------- Chords ---------------- */

const samePcs = (a: number[], b: number[]) => {
  const x = new Set(a.map(mod12));
  const y = new Set(b.map(mod12));
  return x.size === y.size && [...x].every((p) => y.has(p));
};

export function ChordRunner({ def, res }: { def: Extract<PianoExerciseDef, { kind: "chords" }>; res: ResolvedExercise }) {
  const chords = res.chords!;
  const [idx, setIdx] = useState(0);
  const [latch, setLatch] = useState<number[]>([]);
  const [firstTry, setFirstTry] = useState<boolean[]>(() => chords.map(() => true));
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [midiUsed, setMidiUsed] = useState(false);
  const state = useRef({ idx: 0, firstTry: chords.map(() => true), midiHeld: new Set<number>(), wrongCounted: false, usedMidi: false, done: false });
  const done = idx >= chords.length;
  const current = chords[Math.min(idx, chords.length - 1)];

  const markWrong = (played: number[]) => {
    const s = state.current;
    s.firstTry[s.idx] = false;
    setFirstTry([...s.firstTry]);
    const cmp = compareChordTones(chords[s.idx].symbol, played.map(mod12));
    const parts = [];
    if (cmp.missing.length) parts.push(`missing ${cmp.missing.map(cmp.name).join(", ")}`);
    if (cmp.unwanted.length) parts.push(`extra ${cmp.unwanted.map(cmp.name).join(", ")}`);
    setFeedback(`Not ${chords[s.idx].symbol} yet — ${parts.join("; ") || "check your notes"}.`);
  };

  const succeed = () => {
    const s = state.current;
    void playPianoChord(chords[s.idx].notes, 0.9);
    s.idx++;
    s.wrongCounted = false;
    setIdx(s.idx);
    setLatch([]);
    setHint(false);
    setFeedback(null);
    if (s.idx >= chords.length && !s.done) {
      s.done = true;
      const correct = s.firstTry.filter(Boolean).length;
      void saveResult(def, "", s.usedMidi ? "midi" : "virtual", correct, chords.length);
    }
  };

  const toggle = (midi: number) => {
    if (state.current.done) return;
    const next = latch.includes(midi) ? latch.filter((m) => m !== midi) : [...latch, midi];
    setLatch(next);
    setFeedback(null);
    if (samePcs(next, chords[state.current.idx].notes)) succeed();
  };

  useLabMidi((e) => {
    const s = state.current;
    if (s.done) return;
    if (!s.usedMidi) setMidiUsed(true);
    s.usedMidi = true;
    if (e.type === "on") s.midiHeld.add(e.midi);
    else s.midiHeld.delete(e.midi);
    if (s.midiHeld.size === 0) s.wrongCounted = false;
    if (e.type !== "on") return;
    const held = [...s.midiHeld];
    const target = chords[s.idx].notes;
    if (samePcs(held, target)) succeed();
    else if (new Set(held.map(mod12)).size >= new Set(target.map(mod12)).size && !s.wrongCounted) {
      s.wrongCounted = true;
      markWrong(held);
    }
  });

  const check = () => {
    if (!latch.length) return;
    if (samePcs(latch, current.notes)) succeed();
    else markWrong(latch);
  };

  const showHint = () => {
    state.current.firstTry[state.current.idx] = false;
    setFirstTry([...state.current.firstTry]);
    setHint(true);
  };

  const retry = () => {
    state.current = { idx: 0, firstTry: chords.map(() => true), midiHeld: new Set(), wrongCounted: false, usedMidi: false, done: false };
    setIdx(0);
    setLatch([]);
    setFirstTry(chords.map(() => true));
    setHint(false);
    setFeedback(null);
    setMidiUsed(false);
  };

  const highlight: Partial<Record<number, KeyTone>> = {};
  if (!done && hint) for (const n of current.notes) highlight[n] = "hint";
  for (const n of latch) highlight[n] = "chord";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" aria-label="Chords in this exercise">
        {chords.map((c, i) => (
          <Badge key={c.symbol} tone={i < idx ? (firstTry[i] ? "success" : "warn") : i === idx ? "piano" : "neutral"} className="text-sm">
            {c.symbol}
          </Badge>
        ))}
      </div>
      {done ? (
        <DoneCard accuracy={firstTry.filter(Boolean).length / chords.length} correct={firstTry.filter(Boolean).length} total={chords.length} source={midiUsed ? "midi" : "virtual"} onRetry={retry} note="Hints count as a second try, so the score stays honest." />
      ) : (
        <div className="rounded-2xl border border-border bg-surface-2 p-4">
          <p className="text-sm text-muted">Build this chord</p>
          <p className="font-display text-4xl">{current.symbol}</p>
          <p className="mt-1 text-sm text-muted">
            {current.symbol.endsWith("m") ? "Minor" : "Major"} triad: root, third and fifth. {hint && <>Notes: {current.notes.map((n) => midiToName(n)).join(" – ")}</>}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void playPianoChord(current.notes, 1.2)}>
              <Volume2 className="h-4 w-4" /> Hear it
            </Button>
            <Button size="sm" onClick={check} disabled={!latch.length}>
              <CheckCircle2 className="h-4 w-4" /> Check my chord
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLatch([])} disabled={!latch.length}>
              <Eraser className="h-4 w-4" /> Clear
            </Button>
            <Button size="sm" variant="ghost" onClick={showHint} disabled={hint}>
              <Lightbulb className="h-4 w-4" /> Show me
            </Button>
          </div>
          {feedback && (
            <p className="mt-2 text-sm text-warn" role="status" aria-live="polite">
              {feedback}
            </p>
          )}
        </div>
      )}
      <LabKeyboard highlight={highlight} onNoteOn={toggle} ariaLabel="Piano keyboard: click keys to add or remove them from your chord" />
      <p className="text-xs text-muted">With a mouse, click keys to add or remove them (they stay selected). With a MIDI keyboard, just hold the chord — it&apos;s checked automatically.</p>
    </div>
  );
}

/* ---------------- Ear training ---------------- */

export function EarRunner({ def, res }: { def: Extract<PianoExerciseDef, { kind: "ear" }>; res: ResolvedExercise }) {
  const pool = res.pool!;
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const usedMidi = useRef(false);
  const [midiUsed, setMidiUsed] = useState(false);
  const done = round >= def.rounds;

  const pick = (prev: number | null) => {
    const options = pool.filter((p) => p !== prev);
    return options[Math.floor(Math.random() * options.length)];
  };
  const play = (n: number) => void playPianoNote(n, 1.1);

  const start = () => {
    const t = target ?? pick(null);
    setTarget(t);
    play(t);
  };

  const handle = (midi: number, source: Source) => {
    if (target === null || answer !== null || done) return;
    if (source === "midi") {
      usedMidi.current = true;
      setMidiUsed(true);
    }
    setAnswer(midi);
    const ok = mod12(midi) === mod12(target);
    const nextScore = score + (ok ? 1 : 0);
    setScore(nextScore);
    if (round + 1 >= def.rounds) void saveResult(def, "", usedMidi.current ? "midi" : "virtual", nextScore, def.rounds);
  };
  useLabMidi((e) => e.type === "on" && handle(e.midi, "midi"));

  const next = () => {
    const n = round + 1;
    setRound(n);
    setAnswer(null);
    if (n < def.rounds) {
      const t = pick(target);
      setTarget(t);
      play(t);
    }
  };

  const retry = () => {
    setRound(0);
    setScore(0);
    setTarget(null);
    setAnswer(null);
    usedMidi.current = false;
    setMidiUsed(false);
  };

  const correct = answer !== null && target !== null && mod12(answer) === mod12(target);
  const highlight: Partial<Record<number, KeyTone>> = {};
  for (const p of pool) highlight[p] = "scale";
  if (answer !== null && target !== null) {
    highlight[target] = "correct";
    if (!correct) highlight[answer] = "wrong";
  }

  return (
    <div className="space-y-4">
      {done ? (
        <DoneCard accuracy={score / def.rounds} correct={score} total={def.rounds} source={midiUsed ? "midi" : "virtual"} onRetry={retry} note="Any octave of the right note counts." />
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-2 p-4">
          <Ear className="h-6 w-6 text-piano" aria-hidden />
          <div className="mr-auto">
            <p className="font-medium">
              Round {round + 1} of {def.rounds} · Score {score}
            </p>
            <p className="text-sm text-muted">{target === null ? "Press play, listen, then click the key you think it was." : answer === null ? "Which key was it? The possible keys are tinted." : correct ? "Correct — well heard!" : `That was ${midiToName(target)}. You chose ${midiToName(answer!)}.`}</p>
          </div>
          {target === null ? (
            <Button onClick={start} data-testid="ear-start">
              <Play className="h-4 w-4" /> Play note
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => play(target)}>
                <RotateCcw className="h-4 w-4" /> Replay
              </Button>
              {answer !== null && <Button onClick={next}>{round + 1 >= def.rounds ? "Finish" : "Next note"}</Button>}
            </>
          )}
        </div>
      )}
      <LabKeyboard highlight={highlight} hideLabels={answer === null && !done} onNoteOn={(m) => handle(m, "virtual")} ariaLabel="Piano keyboard: answer by clicking the key you heard" />
      <Callout tone="neutral" icon={<Headphones className="h-4 w-4" />}>
        Tip: sing or hum the note back before you answer. Holding a pitch in your voice is how musicians train their ears. Your first key press counts as your answer.
      </Callout>
    </div>
  );
}
