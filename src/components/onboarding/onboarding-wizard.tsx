"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Clock, Ear, Guitar, HeartPulse, Music4, Piano, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BRAND } from "@/config/brand";
import { LESSONS } from "@/content/curriculum";
import { usePrefs } from "@/hooks/use-prefs";
import { practicePlan, nextLesson } from "@/lib/progress/engine";
import { goalsRepo, profileRepo } from "@/lib/storage/repositories";
import type { Instrument, Profile } from "@/lib/storage/schemas";
import { Badge, Button, Callout, Card, Input, ProgressBar, Slider, cn } from "@/components/ui";
import { AudioButton } from "./question-media";

type YesNo = "yes" | "no" | "skip";
type Choice = Instrument | "both";

interface Answers {
  name: string;
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
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
        {(["yes", "no", "skip"] as YesNo[]).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn("h-8 rounded-lg px-3 text-sm capitalize", value === v ? "bg-surface font-medium shadow-sm" : "text-muted")}>
            {v === "skip" ? "Not sure" : v}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const [prefs, setPrefs] = usePrefs();
  const [step, setStep] = useState<Step>("welcome");
  const [saving, setSaving] = useState(false);
  const [checkAnswers, setCheckAnswers] = useState<Record<string, number>>({});
  const [a, setA] = useState<Answers>(() => ({
    name: "",
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
        name: a.name.trim().slice(0, 60),
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
      toast.success(`Welcome${a.name.trim() ? `, ${a.name.trim()}` : ""}! Your plan is ready.`);
      router.push(destination);
    } catch {
      toast.error("We couldn't save your answers, but you can start learning anyway.");
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
        <ProgressBar value={(idx + 1) / STEPS.length} label="Onboarding progress" />
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
            <h1 className="mt-4 font-display text-3xl">Welcome to {BRAND.name}</h1>
            <p className="mt-2 text-muted">A few quick questions so we can build a plan that fits you. No music knowledge needed — we start from zero. You can skip anything optional.</p>
            <label htmlFor="ob-name" className="mt-5 block text-sm font-medium">
              What should we call you? <span className="font-normal text-muted">(optional)</span>
            </label>
            <Input id="ob-name" className="mt-1.5" value={a.name} maxLength={60} placeholder="Your first name" onChange={(e) => set("name", e.target.value)} />
            <p className="mt-2 text-xs text-muted">Saved only on this device.</p>
          </div>
        )}

        {step === "instrument" && (
          <div>
            <h2 className="text-xl font-semibold">Which instrument do you want to learn first?</h2>
            <p className="mt-1 text-sm text-muted">You can switch any time with the toggle at the top — progress is kept separately for each.</p>
            <div role="radiogroup" aria-label="First instrument" className="mt-5 grid gap-3">
              <OptionButton selected={a.instrument === "guitar"} onClick={() => set("instrument", "guitar")} icon={<Guitar className="h-5 w-5 text-guitar" />} testId="ob-guitar">
                <span className="font-medium">Guitar</span>
                <span className="block text-sm text-muted">Acoustic, classical or electric</span>
              </OptionButton>
              <OptionButton selected={a.instrument === "piano"} onClick={() => set("instrument", "piano")} icon={<Piano className="h-5 w-5 text-piano" />} testId="ob-piano">
                <span className="font-medium">Piano / keyboard</span>
                <span className="block text-sm text-muted">Acoustic piano, digital piano or keyboard</span>
              </OptionButton>
              <OptionButton selected={a.instrument === "both"} onClick={() => set("instrument", "both")} icon={<Sparkles className="h-5 w-5 text-accent" />} testId="ob-both">
                <span className="font-medium">Both!</span>
                <span className="block text-sm text-muted">We’ll start you in {prefs.instrument} mode; the shared theory lessons count for both.</span>
              </OptionButton>
            </div>
            {a.instrument === "both" && (
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="text-muted">Start with:</span>
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
            <h2 className="text-xl font-semibold">Have you played before?</h2>
            <div role="radiogroup" aria-label="Experience" className="mt-5 grid gap-3">
              <OptionButton selected={a.experience === "none"} onClick={() => set("experience", "none")}>
                <span className="font-medium">Never — complete beginner</span>
                <span className="block text-sm text-muted">Perfect. We’ll explain every word.</span>
              </OptionButton>
              <OptionButton selected={a.experience === "little"} onClick={() => set("experience", "little")}>
                <span className="font-medium">A little</span>
                <span className="block text-sm text-muted">I’ve tried a few notes or chords.</span>
              </OptionButton>
              <OptionButton selected={a.experience === "some"} onClick={() => set("experience", "some")}>
                <span className="font-medium">Yes, some experience</span>
                <span className="block text-sm text-muted">I can play some songs or read some music.</span>
              </OptionButton>
            </div>
          </div>
        )}

        {step === "time" && (
          <div>
            <h2 className="text-xl font-semibold">How many minutes can you practise each day?</h2>
            <p className="mt-1 text-sm text-muted">Short, regular practice beats long sessions. 10–20 minutes a day is excellent for beginners.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[10, 15, 20, 30, 45].map((m) => (
                <Button key={m} variant={a.dailyMinutes === m ? "primary" : "secondary"} onClick={() => set("dailyMinutes", m)}>
                  <Clock className="h-4 w-4" /> {m} min
                </Button>
              ))}
            </div>
            <Slider className="mt-5" label="Custom" min={5} max={90} step={5} value={a.dailyMinutes} onChange={(v) => set("dailyMinutes", v)} format={(v) => `${v} min`} />
            {a.dailyMinutes > 45 && (
              <Callout tone="warn" className="mt-4" icon={<HeartPulse className="h-4 w-4" />} title="Take breaks">
                Long sessions are split into blocks with breaks. Stop if your hands, wrists or back hurt.
              </Callout>
            )}
          </div>
        )}

        {step === "music" && (
          <div>
            <h2 className="text-xl font-semibold">What music do you enjoy?</h2>
            <p className="mt-1 text-sm text-muted">Optional — helps us suggest songs and videos. Pick as many as you like.</p>
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
            <h2 className="text-xl font-semibold">What equipment do you have?</h2>
            <p className="mt-1 text-sm text-muted">Optional. Everything works with the on-screen instruments — real instruments and MIDI just add more feedback.</p>
            <div className="mt-5 space-y-4">
              <YesNoRow label="Do you own a guitar?" value={a.ownsGuitar} onChange={(v) => set("ownsGuitar", v)} />
              <YesNoRow label="Do you own a piano or keyboard?" value={a.ownsKeyboard} onChange={(v) => set("ownsKeyboard", v)} />
              <YesNoRow label="Do you have a MIDI keyboard (USB / Bluetooth)?" value={a.hasMidi} onChange={(v) => set("hasMidi", v)} />
              <YesNoRow label="Do you have an audio interface?" value={a.hasAudioInterface} onChange={(v) => set("hasAudioInterface", v)} />
            </div>
            <p className="mt-4 text-xs text-muted">Not sure what MIDI is? It’s a cable/USB connection that lets a keyboard tell the computer exactly which keys you press. If you don’t know, choose “Not sure”.</p>
          </div>
        )}

        {step === "plan" && (
          <div>
            <h2 className="text-xl font-semibold">Your daily {a.dailyMinutes}-minute plan</h2>
            <p className="mt-1 text-sm text-muted">
              Focus: <strong className="capitalize text-text">{a.instrument === "both" ? `${primary} first, then the other` : primary}</strong>, plus shared music basics.
            </p>
            <ol className="mt-4 space-y-2">
              {plan.map((b, i) => (
                <li key={i} className={cn("flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm", b.kind === "break" ? "border-dashed border-border-strong text-muted" : "border-border bg-surface-2")}>
                  <span>{b.label}</span>
                  <Badge tone={b.kind === "break" ? "neutral" : "accent"}>{b.minutes} min</Badge>
                </li>
              ))}
            </ol>
            <ul className="mt-4 space-y-1.5 text-sm text-muted">
              {firstLesson && (
                <li>
                  First lesson: <strong className="text-text">{firstLesson.title}</strong>
                </li>
              )}
              {(primary === "guitar" ? a.ownsGuitar : a.ownsKeyboard) === "no" && <li>No instrument yet? No problem — use the virtual {primary} in every lesson.</li>}
              {a.hasMidi === "yes" && <li>Connect your MIDI keyboard in the Piano Lab for the most accurate note and timing feedback (Chrome or Edge).</li>}
              {(primary === "guitar" ? a.ownsGuitar : a.ownsKeyboard) === "yes" && <li>With your real instrument, the microphone tuner and “Listen to me” exercises can check single notes.</li>}
              {a.experience !== "none" && <li>You have some experience — the placement quiz can unlock earlier levels.</li>}
              {a.genres.includes("Bollywood") || a.genres.includes("Indian classical") ? <li>You like Indian music — try the Sargam labels (Settings) and the Song Lab.</li> : null}
            </ul>
          </div>
        )}

        {step === "check" && (
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Ear className="h-5 w-5 text-accent" /> A quick listening check
            </h2>
            <p className="mt-1 text-sm text-muted">Just for fun — no music words, and nothing is locked by your answers. Press play, then choose.</p>
            <div className="mt-5 space-y-5">
              {QUICK_CHECK.map((c) => {
                const ans = checkAnswers[c.id];
                return (
                  <div key={c.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{c.q}</p>
                      <AudioButton audio={c.audio} label="Play" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.options.map((o, i) => (
                        <Button key={o} size="sm" variant={ans === i ? (i === c.answer ? "success" : "danger") : "secondary"} onClick={() => setCheckAnswers((x) => ({ ...x, [c.id]: i }))} aria-pressed={ans === i}>
                          {o}
                        </Button>
                      ))}
                    </div>
                    {ans !== undefined && <p className="mt-2 text-sm text-muted">{ans === c.answer ? "Yes! Well heard." : "Not quite — that's completely normal. Your ear will improve quickly with practice."}</p>}
                  </div>
                );
              })}
            </div>
            {a.experience !== "none" && (
              <Callout className="mt-5" icon={<ClipboardCheck className="h-4 w-4" />} title="Already know some music?">
                Take the 3-minute placement quiz to skip what you know.
              </Callout>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {idx > 0 && (
              <Button variant="ghost" onClick={() => go(-1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {idx === 0 && (
              <Button variant="ghost" onClick={skipAll}>
                Skip setup
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {OPTIONAL.includes(step) && (
              <Button variant="ghost" onClick={() => go(1)}>
                Skip
              </Button>
            )}
            {step === "check" ? (
              <>
                {a.experience !== "none" && (
                  <Button variant="secondary" onClick={() => save("/learn/diagnostic")} loading={saving}>
                    Placement quiz
                  </Button>
                )}
                <Button onClick={() => save(firstLesson ? `/lesson/${firstLesson.id}` : "/dashboard")} loading={saving} data-testid="ob-finish">
                  Start my first lesson <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button onClick={() => go(1)} data-testid="ob-next">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
      <p className="mt-4 text-center text-xs text-muted">
        Already set up? <Link href="/dashboard" className="text-accent hover:underline">Go to the dashboard</Link>
      </p>
    </div>
  );
}
