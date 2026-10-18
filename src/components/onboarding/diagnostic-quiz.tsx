"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Guitar, Music2, Piano, RotateCcw, XCircle } from "lucide-react";
import { NOT_SURE, isCorrect, questionsFor, scorePlacement, type Answers, type TrackResult } from "@/content/diagnostic";
import { LEVEL_NAMES, type Level } from "@/content/types";
import { usePrefs } from "@/hooks/use-prefs";
import { profileRepo } from "@/lib/storage/repositories";
import type { Track } from "@/lib/storage/schemas";
import { Badge, Button, Callout, Card, PageHeader, ProgressBar, cn } from "@/components/ui";
import { toast } from "sonner";
import { AudioButton, QuestionVisual } from "./question-media";

const TRACK_LABEL: Record<Track, { label: string; icon: typeof Guitar }> = {
  theory: { label: "Music basics & theory", icon: Music2 },
  guitar: { label: "Guitar", icon: Guitar },
  piano: { label: "Piano / keyboard", icon: Piano },
};

/** What a placement number means in plain words. */
export function describePlacement(r: TrackResult): string {
  if (r.placement === 0) return "Start from the very beginning (Level 0). Nothing is assumed — that's a great place to be.";
  const lastPassed = r.tiers.filter((t) => t.passed).at(-1)!.tier as Level;
  return `You already know the ideas in Level ${lastPassed} (${LEVEL_NAMES[lastPassed]}). Those lessons are unlocked so you can skip ahead — or revise them any time.`;
}

export function DiagnosticQuiz() {
  const [prefs] = usePrefs();
  const [phase, setPhase] = useState<"setup" | "quiz" | "result">("setup");
  const [instruments, setInstruments] = useState<Track[]>(() => [prefs.instrument]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [saving, setSaving] = useState(false);

  const tracks: Track[] = useMemo(() => ["theory", ...instruments], [instruments]);
  const questions = useMemo(() => questionsFor(tracks), [tracks]);
  const q = questions[index];
  const results = useMemo(() => scorePlacement(tracks, answers), [tracks, answers]);

  const finish = async () => {
    setSaving(true);
    try {
      const existing = await profileRepo.get();
      const placement = { theory: 0, guitar: 0, piano: 0, ...existing?.placement };
      for (const t of tracks) placement[t] = results[t]!.placement;
      await profileRepo.save({ ...existing, placement });
      setPhase("result");
      toast.success("Placement saved. Your curriculum has been updated.");
    } catch {
      toast.error("Couldn't save your placement. Your answers are still shown below.");
      setPhase("result");
    } finally {
      setSaving(false);
    }
  };

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader eyebrow="Placement quiz" title="Where should you start?" description="A few plain-language questions. If you don't know an answer, choose “I'm not sure” — there's no penalty, it just means we'll teach it to you." />
        <Card className="p-5">
          <h2 className="font-semibold">Which instruments should we check?</h2>
          <p className="mt-1 text-sm text-muted">Music basics are always included.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["guitar", "piano"] as Track[]).map((t) => {
              const on = instruments.includes(t);
              const Icon = TRACK_LABEL[t].icon;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setInstruments((cur) => (on ? cur.filter((x) => x !== t) : [...cur, t]))}
                  className={cn("flex items-center gap-3 rounded-xl border p-4 text-left transition-colors", on ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2")}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="font-medium">{TRACK_LABEL[t].label}</span>
                  {on && <CheckCircle2 className="ml-auto h-5 w-5 text-accent" aria-hidden />}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-muted">{questions.length} questions · about {Math.ceil(questions.length / 3)} minutes</p>
          <Button className="mt-4" onClick={() => setPhase("quiz")} data-testid="diagnostic-start">
            Start <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      </div>
    );
  }

  if (phase === "quiz" && q) {
    const chosen = answers[q.id];
    const last = index === questions.length - 1;
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center gap-3">
          <ProgressBar value={(index + 1) / questions.length} label="Quiz progress" />
          <span className="whitespace-nowrap text-sm text-muted">
            {index + 1} / {questions.length}
          </span>
        </div>
        <Card className="p-5 sm:p-6">
          <Badge tone={q.track === "guitar" ? "guitar" : q.track === "piano" ? "piano" : "theory"}>{TRACK_LABEL[q.track].label}</Badge>
          <h2 className="mt-3 text-lg font-semibold" id="dq-title">{q.question}</h2>
          {(q.audio || q.visual) && (
            <div className="mt-4 space-y-3">
              {q.audio && <AudioButton audio={q.audio} label="Play the sound" fallback={q.track === "guitar" ? "guitar" : "piano"} />}
              {q.visual && <QuestionVisual visual={q.visual} />}
            </div>
          )}
          <div role="radiogroup" aria-labelledby="dq-title" className="mt-5 grid gap-2">
            {q.options.map((o, i) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={chosen === i}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                  chosen === i ? "border-accent bg-accent-soft font-medium" : "border-border hover:bg-surface-2",
                  o === NOT_SURE && "italic text-muted",
                )}
              >
                {o}
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-between gap-2">
            <Button variant="ghost" onClick={() => (index === 0 ? setPhase("setup") : setIndex(index - 1))}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {last ? (
              <Button onClick={finish} loading={saving} disabled={chosen === undefined} data-testid="diagnostic-finish">
                See my starting point
              </Button>
            ) : (
              <Button onClick={() => setIndex(index + 1)} disabled={chosen === undefined} data-testid="diagnostic-next">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Results
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Your placement" title="Here's where you'll start" description="Placement only unlocks lessons — it never marks them as completed or mastered. You can revise any earlier lesson whenever you like." />
      <div className="grid gap-4">
        {tracks.map((t) => {
          const r = results[t]!;
          const Icon = TRACK_LABEL[t].icon;
          return (
            <Card key={t} className="p-5" data-testid={`placement-${t}`}>
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-accent" aria-hidden />
                <h3 className="font-semibold">{TRACK_LABEL[t].label}</h3>
                <Badge tone="accent" className="ml-auto">{r.placement === 0 ? "Start at Level 0" : `Unlocked up to Level ${r.tiers.filter((x) => x.passed).at(-1)!.tier}`}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{describePlacement(r)}</p>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                {r.tiers.map((tier) => (
                  <li key={tier.tier}>
                    <Badge tone={tier.passed ? "success" : "neutral"} title={tier.passed ? "Known" : "Not counted yet — earlier levels come first"}>
                      Level {tier.tier}: {tier.correct}/{tier.total}
                      {tier.passed ? " ✓" : ""}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
      <details className="mt-6 rounded-xl border border-border bg-surface p-4">
        <summary className="cursor-pointer font-medium">Review your answers</summary>
        <ul className="mt-3 space-y-3">
          {questions.map((qq) => {
            const ok = isCorrect(qq, answers[qq.id]);
            return (
              <li key={qq.id} className="flex gap-2 text-sm">
                {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Correct" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Not yet" />}
                <span>
                  <span className="font-medium">{qq.question}</span>
                  <span className="block text-muted">{qq.explanation}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </details>
      <Callout className="mt-6" title="Remember">Starting low is never a waste: early lessons are short, and the measured exercises help you prove (and polish) what you already know.</Callout>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/learn">
          <Button>
            Go to my curriculum <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          variant="secondary"
          onClick={() => {
            setAnswers({});
            setIndex(0);
            setPhase("setup");
          }}
        >
          <RotateCcw className="h-4 w-4" /> Retake
        </Button>
      </div>
    </div>
  );
}
