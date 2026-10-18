"use client";
import { useT, useTx, useTm } from "@/lib/i18n";

import { useState } from "react";
import { ArrowDownUp, Flame, Music, Repeat, Volume2 } from "lucide-react";
import { usePrefs } from "@/hooks/use-prefs";
import { usePracticeLog } from "@/hooks/use-practice-log";
import { PianoKeyboard, type KeyTone } from "@/components/instruments/piano-keyboard";
import { Badge, Button, Card, CardBody, CardHeader, Segmented, cn } from "@/components/ui";
import { ensureAudio, playPianoChord, playPianoNote } from "@/lib/audio/engine";
import { pcName } from "@/lib/music/notes";
import { exerciseRepo } from "@/lib/storage/repositories";
import { makeQuestion, seededRng, type EarMode, type EarQuestion } from "./logic/ear";

const MODES: { id: EarMode; label: string; description: string }[] = [
  { id: "high-low", label: "High or low", description: "Is the second note higher or lower?" },
  { id: "match-note", label: "Match a note", description: "Find the note you hear on the keyboard." },
  { id: "major-minor", label: "Major / minor", description: "Bright or darker chord?" },
  { id: "interval", label: "Intervals", description: "Name the distance between two notes." },
  { id: "melody", label: "Repeat a melody", description: "Play back a short tune." },
  { id: "scale-note", label: "Scale degrees", description: "Which note of the scale is it?" },
  { id: "swara", label: "Swara (Sargam)", description: "Which swara after Sa?" },
];

async function playQuestion(q: EarQuestion) {
  await ensureAudio();
  let t = 0;
  for (const part of q.play) {
    if (part.kind === "chord") {
      void playPianoChord(part.notes, 1.2, t);
      t += 1.5;
    } else {
      part.notes.forEach((n, i) => void playPianoNote(n, 0.55, t + i * 0.6));
      t += part.notes.length * 0.6 + 0.4;
    }
  }
}

export function EarTraining() {
  const tr = useT();
  const tm = useTm();
  const tx = useTx();
  const [prefs] = usePrefs();
  const [mode, setMode] = useState<EarMode>("high-low");
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  // First question is deterministic so server and client render the same thing.
  const [q, setQ] = useState<EarQuestion>(() => makeQuestion("high-low", seededRng(1)));
  const [answer, setAnswer] = useState<string | null>(null);
  const [played, setPlayed] = useState<number[]>([]);
  const [stats, setStats] = useState({ right: 0, total: 0, streak: 0, best: 0 });
  const { ping } = usePracticeLog("Ear training", { instrument: prefs.instrument });

  const fresh = (m: EarMode, l: number) => {
    setQ(makeQuestion(m, Math.random, prefs.tonicPc, l));
    setAnswer(null);
    setPlayed([]);
  };
  const changeMode = (m: EarMode) => {
    setMode(m);
    fresh(m, level);
  };
  const changeLevel = (l: 1 | 2 | 3) => {
    setLevel(l);
    fresh(mode, l);
  };
  const isKeyboardMode = !!q.answerNotes && q.options.length === 0;

  const submit = (given: string, correct: boolean) => {
    setAnswer(given);
    ping();
    setStats((s) => {
      const streak = correct ? s.streak + 1 : 0;
      return { right: s.right + (correct ? 1 : 0), total: s.total + 1, streak, best: Math.max(s.best, streak) };
    });
    void exerciseRepo.add({ instrument: "theory", exerciseId: `ear:${mode}`, skill: `ear:${mode}`, input: "virtual", correct: correct ? 1 : 0, total: 1, accuracy: correct ? 1 : 0, measured: true });
  };

  const onKey = (m: number) => {
    if (!isKeyboardMode || answer) return;
    const next = [...played, m];
    setPlayed(next);
    const targets = q.answerNotes!;
    // Compare by pitch class: an octave mistake still counts as hearing the right note.
    const ok = next.every((n, i) => n % 12 === targets[i] % 12);
    if (!ok || next.length === targets.length) submit(next.map((n) => pcName(n)).join(" "), ok && next.length === targets.length);
  };

  const nextQ = () => {
    const nq = makeQuestion(mode, Math.random, prefs.tonicPc, level);
    setQ(nq);
    setAnswer(null);
    setPlayed([]);
    void playQuestion(nq);
  };

  const correct = answer !== null && (isKeyboardMode ? played.every((n, i) => n % 12 === q.answerNotes![i] % 12) && played.length === q.answerNotes!.length : answer === q.answer);

  const highlight: Partial<Record<number, KeyTone>> = {};
  if (isKeyboardMode) {
    played.forEach((n, i) => (highlight[n] = n % 12 === q.answerNotes![i] % 12 ? "correct" : "wrong"));
    if (answer) q.answerNotes!.forEach((n) => (highlight[n] ??= "target"));
  }

  return (
    <div className="space-y-6">
      <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label={tr("ui.ear_training_exercise")}>
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => changeMode(m.id)} className={cn("shrink-0 rounded-xl border px-3 py-2 text-left text-sm transition-colors", mode === m.id ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:bg-surface-2")}>
            <span className="block font-medium">{tx(m.label)}</span>
            <span className="block text-xs text-muted">{tx(m.description)}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <Card>
          <CardHeader title={tm(q.promptMsg)} icon={<Music className="h-5 w-5" />} action={<Segmented label={tr("ui.difficulty")} size="sm" value={level} onChange={changeLevel} options={[{ value: 1, label: tr("ui.easy") }, { value: 2, label: tr("ui.medium") }, { value: 3, label: tr("ui.hard") }]} />} />
          <CardBody className="space-y-5">
            <Button size="lg" onClick={() => void playQuestion(q)} data-testid="ear-play"><Volume2 className="h-5 w-5" /> {answer ? tr("ui.hear_it_again") : tr("ui.play")}</Button>
            {mode === "swara" && <p className="text-sm text-muted">{tr("ui.your_sa_is")} <strong>{pcName(prefs.tonicPc)}</strong> {tr("ui.change_it_in_settings")}</p>}
            {q.options.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    disabled={!!answer}
                    onClick={() => submit(o, o === q.answer)}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left font-medium transition-colors",
                      answer && o === q.answer ? "border-success bg-success-soft text-success" : answer === o ? "border-danger bg-danger-soft text-danger" : "border-border bg-surface-2 hover:border-accent disabled:opacity-70",
                    )}
                  >
                    {mode === "high-low" && <ArrowDownUp className="mr-2 inline h-4 w-4" />}
                    {tx(o)}
                  </button>
                ))}
              </div>
            )}
            {isKeyboardMode && (
              <div className="space-y-2">
                <p className="text-sm text-muted">{mode === "melody" ? tr("ui.played_of_notes", { a: played.length, b: q.answerNotes!.length }) : tr("ui.click_the_key_you_think_it_is")}</p>
                <PianoKeyboard low={60} high={72} labels={answer ? "white" : "none"} highlight={highlight} onNoteOn={onKey} whiteKeyWidth={46} height={150} focusMidi={66} />
              </div>
            )}
            {answer && (
              <div className={cn("rounded-xl p-4", correct ? "bg-success-soft" : "bg-danger-soft")} aria-live="polite">
                <p className="font-semibold">{correct ? tr("ui.correct") : tr("ui.answer_was", { a: tx(q.answer) })}</p>
                <p className="text-sm text-muted">{tm(q.explanationMsg)}</p>
                <Button className="mt-3" onClick={nextQ}><Repeat className="h-4 w-4" /> {tr("ui.next_question")}</Button>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader title={tr("ui.session")} />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-muted">{tr("ui.score")}</span><span className="text-xl font-semibold">{stats.right}/{stats.total}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted">{tr("dash.streak")}</span><Badge tone={stats.streak >= 3 ? "accent" : "neutral"}><Flame className="h-3 w-3" /> {stats.streak}</Badge></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted">{tr("ui.best_streak")}</span><span className="font-medium">{stats.best}</span></div>
            <p className="pt-2 text-xs text-muted">{tr("ui.ear_training_improves_slowly_5_minutes_a_day_bea")}</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
