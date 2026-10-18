"use client";
import { useT, lessonText, useLang, type MessageKey } from "@/lib/i18n";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Clock, Ear, Guitar, HeartPulse, Music4, Piano, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BRAND } from "@/config/brand";
import { LESSONS } from "@/content/curriculum";
import { useLearner } from "@/hooks/use-learner";
import { usePrefs } from "@/hooks/use-prefs";
import { practicePlan, nextLesson } from "@/lib/progress/engine";
import { goalsRepo, profileRepo } from "@/lib/storage/repositories";
import type { Instrument, Profile } from "@/lib/storage/schemas";
import { Badge, Button, Callout, Card, ProgressBar, Slider, cn } from "@/components/ui";
import { AudioButton } from "./question-media";

type YesNo = "yes" | "no" | "skip";
type Choice = Instrument | "both";

interface Answers {
  instrument: Choice;
  experience: Profile["experience"];
  dailyMinutes: number;
  genres: string[];
  ownsGuitar: YesNo;
  ownsKeyboard: YesNo;
  hasMidi: YesNo;
  hasAudioInterface: YesNo;
}

const GENRES = ["Bollywood", "Hindi / indie", "Pop", "Rock", "Western classical", "Indian classical", "Devotional / bhajan", "Jazz & blues", "Film & game scores", "Folk", "Other"];

const STEPS = ["welcome", "instrument", "experience", "time", "music", "gear", "plan", "check"] as const;
type Step = (typeof STEPS)[number];
const OPTIONAL: Step[] = ["music", "gear"];

/** Short no-jargon listening check (informational — it doesn't lock anything). */
const QUICK_CHECK = [
  { id: "qc1", q: "Which note is higher?", audio: { type: "notes" as const, notes: ["E4", "B4"], step: 0.9 }, options: ["The first one", "The second one"], answer: 1 },
  { id: "qc2", q: "Are these two notes the same or different?", audio: { type: "notes" as const, notes: ["G4", "G4"], step: 0.9 }, options: ["Same", "Different"], answer: 0 },
  { id: "qc3", q: "Is this pattern of clicks steady (evenly spaced)?", audio: { type: "rhythm" as const, pattern: [0, 1, 1.4, 3], bpm: 80, beatsPerBar: 4 }, options: ["Yes, steady", "No, uneven"], answer: 1 },
];

function OptionButton({ selected, onClick, children, icon, testId }: { selected: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      data-testid={testId}
      className={cn("flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors", selected ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-2")}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {selected && <Check className="h-5 w-5 text-accent" aria-hidden />}
    </button>
  );
}

function YesNoRow({ label, value, onChange }: { label: string; value: YesNo; onChange: (v: YesNo) => void }) {
  const tr = useT();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
        {(["yes", "no", "skip"] as YesNo[]).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn("h-8 rounded-lg px-3 text-sm capitalize", value === v ? "bg-surface font-medium shadow-sm" : "text-muted")}>
            {v === "skip" ? tr("ui.not_sure") : v}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OnboardingWizard() {
  const tr = useT();
  const lang = useLang();
  const router = useRouter();
  const [prefs, setPrefs] = usePrefs();
  const { learner } = useLearner();
  const [step, setStep] = useState<Step>("welcome");
  const [saving, setSaving] = useState(false);
  const [checkAnswers, setCheckAnswers] = useState<Record<string, number>>({});
  const [a, setA] = useState<Answers>(() => ({
    instrument: prefs.instrument,
    experience: "none",
    dailyMinutes: 20,
    genres: [],
    ownsGuitar: "skip",
    ownsKeyboard: "skip",
    hasMidi: "skip",
    hasAudioInterface: "skip",
  }));
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((x) => ({ ...x, [k]: v }));
  const idx = STEPS.indexOf(step);
  const go = (d: 1 | -1) => setStep(STEPS[Math.min(STEPS.length - 1, Math.max(0, idx + d))]);
  const primary: Instrument = a.instrument === "both" ? (prefs.instrument ?? "guitar") : a.instrument;
  const plan = practicePlan(a.dailyMinutes);
  const firstLesson = nextLesson(LESSONS, {}, [primary, "theory"]);

  const save = async (destination: string) => {
    setSaving(true);
    try {
      const existing = await profileRepo.get();
      await profileRepo.save({
        ...existing,
        name: learner?.name ?? existing?.name ?? "",
        firstInstrument: primary,
        experience: a.experience,
        dailyMinutes: a.dailyMinutes,
        genres: a.genres,
        ownsGuitar: a.ownsGuitar,
        ownsKeyboard: a.ownsKeyboard,
        hasMidi: a.hasMidi,
        hasAudioInterface: a.hasAudioInterface,
      });
      const goals = await goalsRepo.get();
      await goalsRepo.save({ ...goals, dailyMinutes: a.dailyMinutes });
      setPrefs({ instrument: primary, onboarded: true });
      toast.success(learner?.name ? tr("ui.welcome_plan_ready_name", { name: learner.name }) : tr("ui.welcome_plan_ready"));
      router.push(destination);
    } catch {
      toast.error(tr("ui.we_couldn_t_save_your_answers_but_you_can_start"));
      setPrefs({ instrument: primary, onboarded: true });
      router.push(destination);
    } finally {
      setSaving(false);
    }
  };

  const skipAll = () => {
    setPrefs({ onboarded: true });
    router.push("/dashboard");
  };

  return (
    <div className="mx-auto max-w-2xl" data-testid="onboarding">
      <div className="mb-5 flex items-center gap-3">
        <ProgressBar value={(idx + 1) / STEPS.length} label={tr("ui.onboarding_progress")} />
        <span className="whitespace-nowrap text-xs text-muted">
          Step {idx + 1} of {STEPS.length}
        </span>
      </div>

      <Card className="p-5 sm:p-7">
        {step === "welcome" && (
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-guitar to-piano text-white">
              <Music4 className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="mt-4 font-display text-3xl">{learner?.name ? tr("ui.welcome_name", { name: learner.name }) : tr("ui.welcome_to", { brand: BRAND.name })}</h1>
            <p className="mt-2 text-muted">{tr("ui.a_few_quick_questions_so_we_can_build_a_plan_tha")}</p>
          </div>
        )}

        {step === "instrument" && (
          <div>
            <h2 className="text-xl font-semibold">{tr("ui.which_instrument_do_you_want_to_learn_first")}</h2>
            <p className="mt-1 text-sm text-muted">{tr("ui.you_can_switch_any_time_with_the_toggle_at_the_t")}</p>
            <div role="radiogroup" aria-label={tr("ui.first_instrument")} className="mt-5 grid gap-3">
              <OptionButton selected={a.instrument === "guitar"} onClick={() => set("instrument", "guitar")} icon={<Guitar className="h-5 w-5 text-guitar" />} testId="ob-guitar">
                <span className="font-medium">{tr("shell.guitar")}</span>
                <span className="block text-sm text-muted">{tr("ui.acoustic_classical_or_electric")}</span>
              </OptionButton>
              <OptionButton selected={a.instrument === "piano"} onClick={() => set("instrument", "piano")} icon={<Piano className="h-5 w-5 text-piano" />} testId="ob-piano">
                <span className="font-medium">{tr("ui.piano_keyboard")}</span>
                <span className="block text-sm text-muted">{tr("ui.acoustic_piano_digital_piano_or_keyboard")}</span>
              </OptionButton>
              <OptionButton selected={a.instrument === "both"} onClick={() => set("instrument", "both")} icon={<Sparkles className="h-5 w-5 text-accent" />} testId="ob-both">
                <span className="font-medium">{tr("ui.both_2")}</span>
                <span className="block text-sm text-muted">{tr(prefs.instrument === "guitar" ? "ui.start_in_guitar_mode" : "ui.start_in_piano_mode")}</span>
              </OptionButton>
            </div>
            {a.instrument === "both" && (
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="text-muted">{tr("ui.start_with")}</span>
                {(["guitar", "piano"] as Instrument[]).map((i) => (
                  <Button key={i} size="sm" variant={prefs.instrument === i ? "primary" : "secondary"} onClick={() => setPrefs({ instrument: i })} className="capitalize">
                    {i}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "experience" && (
          <div>
            <h2 className="text-xl font-semibold">{tr("ui.have_you_played_before")}</h2>
            <div role="radiogroup" aria-label={tr("ui.experience")} className="mt-5 grid gap-3">
              <OptionButton selected={a.experience === "none"} onClick={() => set("experience", "none")}>
                <span className="font-medium">{tr("ui.never_complete_beginner")}</span>
                <span className="block text-sm text-muted">{tr("ui.perfect_we_ll_explain_every_word")}</span>
              </OptionButton>
              <OptionButton selected={a.experience === "little"} onClick={() => set("experience", "little")}>
                <span className="font-medium">{tr("ui.a_little")}</span>
                <span className="block text-sm text-muted">{tr("ui.i_ve_tried_a_few_notes_or_chords")}</span>
              </OptionButton>
              <OptionButton selected={a.experience === "some"} onClick={() => set("experience", "some")}>
                <span className="font-medium">{tr("ui.yes_some_experience")}</span>
                <span className="block text-sm text-muted">{tr("ui.i_can_play_some_songs_or_read_some_music")}</span>
              </OptionButton>
            </div>
          </div>
        )}

        {step === "time" && (
          <div>
            <h2 className="text-xl font-semibold">{tr("ui.how_many_minutes_can_you_practise_each_day")}</h2>
            <p className="mt-1 text-sm text-muted">{tr("ui.short_regular_practice_beats_long_sessions_10_20")}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[10, 15, 20, 30, 45].map((m) => (
                <Button key={m} variant={a.dailyMinutes === m ? "primary" : "secondary"} onClick={() => set("dailyMinutes", m)}>
                  <Clock className="h-4 w-4" /> {m} min
                </Button>
              ))}
            </div>
            <Slider className="mt-5" label={tr("ui.custom")} min={5} max={90} step={5} value={a.dailyMinutes} onChange={(v) => set("dailyMinutes", v)} format={(v) => `${v} min`} />
            {a.dailyMinutes > 45 && (
              <Callout tone="warn" className="mt-4" icon={<HeartPulse className="h-4 w-4" />} title={tr("ui.take_breaks")}>
                {tr("ui.long_sessions_are_split_into_blocks_with_breaks")}
              </Callout>
            )}
          </div>
        )}

        {step === "music" && (
          <div>
            <h2 className="text-xl font-semibold">{tr("ui.what_music_do_you_enjoy")}</h2>
            <p className="mt-1 text-sm text-muted">{tr("ui.optional_helps_us_suggest_songs_and_videos_pick")}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const on = a.genres.includes(g);
                return (
                  <button key={g} type="button" aria-pressed={on} onClick={() => set("genres", on ? a.genres.filter((x) => x !== g) : [...a.genres, g])} className={cn("rounded-full border px-4 py-2 text-sm transition-colors", on ? "border-accent bg-accent-soft font-medium text-accent" : "border-border hover:bg-surface-2")}>
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "gear" && (
          <div>
            <h2 className="text-xl font-semibold">{tr("ui.what_equipment_do_you_have")}</h2>
            <p className="mt-1 text-sm text-muted">{tr("ui.optional_everything_works_with_the_on_screen_ins")}</p>
            <div className="mt-5 space-y-4">
              <YesNoRow label={tr("ui.do_you_own_a_guitar")} value={a.ownsGuitar} onChange={(v) => set("ownsGuitar", v)} />
              <YesNoRow label={tr("ui.do_you_own_a_piano_or_keyboard")} value={a.ownsKeyboard} onChange={(v) => set("ownsKeyboard", v)} />
              <YesNoRow label={tr("ui.do_you_have_a_midi_keyboard_usb_bluetooth")} value={a.hasMidi} onChange={(v) => set("hasMidi", v)} />
              <YesNoRow label={tr("ui.do_you_have_an_audio_interface")} value={a.hasAudioInterface} onChange={(v) => set("hasAudioInterface", v)} />
            </div>
            <p className="mt-4 text-xs text-muted">{tr("ui.not_sure_what_midi_is_it_s_a_cable_usb_connectio")}</p>
          </div>
        )}

        {step === "plan" && (
          <div>
            <h2 className="text-xl font-semibold">{tr("ui.daily_plan_title", { n: a.dailyMinutes })}</h2>
            <p className="mt-1 text-sm text-muted">
              {tr("ui.focus")} <strong className="capitalize text-text">{a.instrument === "both" ? tr(primary === "guitar" ? "ui.focus_both_guitar" : "ui.focus_both_piano") : tr(primary === "guitar" ? "shell.guitar" : "shell.piano")}</strong>{tr("ui.plus_shared_music_basics")}
            </p>
            <ol className="mt-4 space-y-2">
              {plan.map((b, i) => (
                <li key={i} className={cn("flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm", b.kind === "break" ? "border-dashed border-border-strong text-muted" : "border-border bg-surface-2")}>
                  <span>{tr(`dash.plan.${b.kind}` as MessageKey)}</span>
                  <Badge tone={b.kind === "break" ? "neutral" : "accent"}>{tr("common.min", { n: b.minutes })}</Badge>
                </li>
              ))}
            </ol>
            <ul className="mt-4 space-y-1.5 text-sm text-muted">
              {firstLesson && (
                <li>
                  {tr("ui.first_lesson")} <strong className="text-text">{lessonText(firstLesson, lang).title}</strong>
                </li>
              )}
              {(primary === "guitar" ? a.ownsGuitar : a.ownsKeyboard) === "no" && <li>{tr(primary === "guitar" ? "ui.no_instrument_guitar" : "ui.no_instrument_piano")}</li>}
              {a.hasMidi === "yes" && <li>{tr("ui.connect_your_midi_keyboard_in_the_piano_lab_for")}</li>}
              {(primary === "guitar" ? a.ownsGuitar : a.ownsKeyboard) === "yes" && <li>{tr("ui.with_your_real_instrument_the_microphone_tuner_a")}</li>}
              {a.experience !== "none" && <li>{tr("ui.you_have_some_experience_the_placement_quiz_can")}</li>}
              {a.genres.includes("Bollywood") || a.genres.includes("Indian classical") ? <li>{tr("ui.you_like_indian_music_try_the_sargam_labels_sett")}</li> : null}
            </ul>
          </div>
        )}

        {step === "check" && (
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Ear className="h-5 w-5 text-accent" /> {tr("ui.a_quick_listening_check")}
            </h2>
            <p className="mt-1 text-sm text-muted">{tr("ui.just_for_fun_no_music_words_and_nothing_is_locke")}</p>
            <div className="mt-5 space-y-5">
              {QUICK_CHECK.map((c) => {
                const ans = checkAnswers[c.id];
                return (
                  <div key={c.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{c.q}</p>
                      <AudioButton audio={c.audio} label={tr("ui.play")} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.options.map((o, i) => (
                        <Button key={o} size="sm" variant={ans === i ? (i === c.answer ? "success" : "danger") : "secondary"} onClick={() => setCheckAnswers((x) => ({ ...x, [c.id]: i }))} aria-pressed={ans === i}>
                          {o}
                        </Button>
                      ))}
                    </div>
                    {ans !== undefined && <p className="mt-2 text-sm text-muted">{ans === c.answer ? tr("ui.yes_well_heard") : tr("ui.not_quite_that_s_completely_normal_your_ear_will")}</p>}
                  </div>
                );
              })}
            </div>
            {a.experience !== "none" && (
              <Callout className="mt-5" icon={<ClipboardCheck className="h-4 w-4" />} title={tr("ui.already_know_some_music")}>
                {tr("ui.take_the_3_minute_placement_quiz_to_skip_what_yo")}
              </Callout>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {idx > 0 && (
              <Button variant="ghost" onClick={() => go(-1)}>
                <ArrowLeft className="h-4 w-4" /> {tr("common.back")}
              </Button>
            )}
            {idx === 0 && (
              <Button variant="ghost" onClick={skipAll}>
                {tr("ui.skip_setup")}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {OPTIONAL.includes(step) && (
              <Button variant="ghost" onClick={() => go(1)}>
                {tr("ui.skip")}
              </Button>
            )}
            {step === "check" ? (
              <>
                {a.experience !== "none" && (
                  <Button variant="secondary" onClick={() => save("/learn/diagnostic")} loading={saving}>
                    {tr("ui.placement_quiz")}
                  </Button>
                )}
                <Button onClick={() => save(firstLesson ? `/lesson/${firstLesson.id}` : "/dashboard")} loading={saving} data-testid="ob-finish">
                  {tr("ui.start_my_first_lesson")} <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button onClick={() => go(1)} data-testid="ob-next">
                {tr("common.continue")} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
      <p className="mt-4 text-center text-xs text-muted">
        {tr("ui.already_set_up")} <Link href="/dashboard" className="text-accent hover:underline">{tr("ui.go_to_the_dashboard")}</Link>
      </p>
    </div>
  );
}
