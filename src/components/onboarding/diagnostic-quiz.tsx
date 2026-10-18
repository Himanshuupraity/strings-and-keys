"use client";
import { useT, useTx } from "@/lib/i18n";

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
  const tr = useT();
  const tx = useTx();
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
      toast.success(tr("ui.placement_saved_your_curriculum_has_been_updated"));
    } catch {
      toast.error(tr("ui.couldn_t_save_your_placement_your_answers_are_st"));
      setPhase("result");
    } finally {
      setSaving(false);
    }
  };

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader eyebrow={tr("ui.placement_quiz")} title={tr("ui.where_should_you_start")} description={tr("ui.a_few_plain_language_questions_if_you_don_t_know")} />
        <Card className="p-5">
          <h2 className="font-semibold">{tr("ui.which_instruments_should_we_check")}</h2>
          <p className="mt-1 text-sm text-muted">{tr("ui.music_basics_are_always_included")}</p>
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
                  <span className="font-medium">{tx(TRACK_LABEL[t].label)}</span>
                  {on && <CheckCircle2 className="ml-auto h-5 w-5 text-accent" aria-hidden />}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-muted">{tr("ui.n_questions_minutes", { n: questions.length, m: Math.ceil(questions.length / 3) })}</p>
          <Button className="mt-4" onClick={() => setPhase("quiz")} data-testid="diagnostic-start">
            {tr("common.start")} <ArrowRight className="h-4 w-4" />
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
          <ProgressBar value={(index + 1) / questions.length} label={tr("ui.quiz_progress")} />
          <span className="whitespace-nowrap text-sm text-muted">
            {index + 1} / {questions.length}
          </span>
        </div>
        <Card className="p-5 sm:p-6">
          <Badge tone={q.track === "guitar" ? "guitar" : q.track === "piano" ? "piano" : "theory"}>{tx(TRACK_LABEL[q.track].label)}</Badge>
          <h2 className="mt-3 text-lg font-semibold" id="dq-title">{q.question}</h2>
          {(q.audio || q.visual) && (
            <div className="mt-4 space-y-3">
              {q.audio && <AudioButton audio={q.audio} label={tr("ui.play_the_sound")} fallback={q.track === "guitar" ? "guitar" : "piano"} />}
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
              <ArrowLeft className="h-4 w-4" /> {tr("common.back")}
            </Button>
            {last ? (
              <Button onClick={finish} loading={saving} disabled={chosen === undefined} data-testid="diagnostic-finish">
                {tr("ui.see_my_starting_point")}
              </Button>
            ) : (
              <Button onClick={() => setIndex(index + 1)} disabled={chosen === undefined} data-testid="diagnostic-next">
                {tr("common.next")} <ArrowRight className="h-4 w-4" />
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
      <PageHeader eyebrow={tr("ui.your_placement")} title={tr("ui.here_s_where_you_ll_start")} description={tr("ui.placement_only_unlocks_lessons_it_never_marks_th")} />
      <div className="grid gap-4">
        {tracks.map((t) => {
          const r = results[t]!;
          const Icon = TRACK_LABEL[t].icon;
          return (
            <Card key={t} className="p-5" data-testid={`placement-${t}`}>
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-accent" aria-hidden />
                <h3 className="font-semibold">{tx(TRACK_LABEL[t].label)}</h3>
                <Badge tone="accent" className="ml-auto">{r.placement === 0 ? tr("ui.start_at_level_0") : `Unlocked up to Level ${r.tiers.filter((x) => x.passed).at(-1)!.tier}`}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{r.placement === 0 ? tr("ui.start_from_the_very_beginning_level_0_nothing_is") : tr("ui.placement_known", { n: r.tiers.filter((x) => x.passed).at(-1)!.tier, name: tx(LEVEL_NAMES[r.tiers.filter((x) => x.passed).at(-1)!.tier as Level]) })}</p>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                {r.tiers.map((tier) => (
                  <li key={tier.tier}>
                    <Badge tone={tier.passed ? "success" : "neutral"} title={tier.passed ? "Known" : tr("ui.not_counted_yet_earlier_levels_come_first")}>
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
        <summary className="cursor-pointer font-medium">{tr("ui.review_your_answers")}</summary>
        <ul className="mt-3 space-y-3">
          {questions.map((qq) => {
            const ok = isCorrect(qq, answers[qq.id]);
            return (
              <li key={qq.id} className="flex gap-2 text-sm">
                {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label={tr("ui.correct_2")} /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label={tr("ui.not_yet")} />}
                <span>
                  <span className="font-medium">{qq.question}</span>
                  <span className="block text-muted">{qq.explanation}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </details>
      <Callout className="mt-6" title={tr("ui.remember")}>{tr("ui.starting_low_is_never_a_waste_early_lessons_are")}</Callout>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/learn">
          <Button>
            {tr("ui.go_to_my_curriculum")} <ArrowRight className="h-4 w-4" />
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
          <RotateCcw className="h-4 w-4" /> {tr("ui.retake")}
        </Button>
      </div>
    </div>
  );
}
