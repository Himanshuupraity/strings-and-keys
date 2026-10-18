"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Award, BookOpen, CalendarCheck, Clock, Flame, Guitar, Piano, PlayCircle, Sparkles, Target, TrendingUp, Trophy } from "lucide-react";
import { Badge, Button, Callout, Card, CardBody, CardHeader, EmptyState, ProgressBar, Skeleton, SourceTag, cn } from "@/components/ui";
import { InstrumentToggle } from "@/components/layout/instrument-toggle";
import { usePrefs, useHydrated } from "@/hooks/use-prefs";
import { useLearner } from "@/hooks/use-learner";
import { LESSONS, getLesson, lessonsForInstrument } from "@/content/curriculum";
import { RevisionCard } from "./revision-card";
import { NextSongCard } from "./next-song-card";
import { LEVEL_NAMES, type Level } from "@/content/types";
import { isDone, nextLesson, practicePlan, practiceStreak, totalMinutes, weakSkills, weeklyMinutes } from "@/lib/progress/engine";
import { achievements, currentLevel, isEmptyLearner, useLearnerData } from "./learner-data";
import { WeeklyChart, type WeeklyRow } from "./weekly-chart";

const SAMPLE_WEEK: WeeklyRow[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => ({
  day: `sample-${i}`,
  label,
  guitar: [12, 0, 15, 10, 18, 20, 8][i],
  piano: [0, 10, 5, 0, 6, 12, 0][i],
}));

function withinDays(iso: string, days: number) {
  return Date.now() - new Date(iso).getTime() < days * 864e5;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function planLink(kind: string, instrument: "guitar" | "piano", nextId?: string) {
  switch (kind) {
    case "warmup":
      return instrument === "guitar" ? "/guitar-lab?tab=exercises" : "/piano-lab";
    case "learn":
      return nextId ? `/lesson/${nextId}` : "/learn";
    case "exercise":
      return instrument === "guitar" ? "/practice/chord-drill" : "/practice/scale-trainer";
    case "apply":
      return "/songs";
    case "recap":
      return "/progress";
    default:
      return null;
  }
}

export function Dashboard() {
  const [prefs] = usePrefs();
  const hydrated = useHydrated();
  const { data, loading } = useLearnerData();
  const { learner } = useLearner();
  const learnerName = learner?.name ?? data.profile?.name;
  const instrument = prefs.instrument;
  const lessons = useMemo(() => lessonsForInstrument(instrument), [instrument]);
  if (!hydrated) return <DashboardSkeleton />;
  const placement = data.profile?.placement;
  const next = nextLesson(LESSONS, data.progress, [instrument, "theory"], placement);
  const inProgress = Object.values(data.progress)
    .filter((p) => p.status === "in-progress" && (p.track === instrument || p.track === "theory"))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const continueLesson = inProgress ? getLesson(inProgress.lessonId) : next;
  const level = currentLevel(lessons, data.progress, placement?.[instrument] ?? 0) as Level;
  const instrSessions = data.sessions.filter((s) => s.instrument === instrument);
  const streak = practiceStreak(data.sessions);
  const week = weeklyMinutes(data.sessions);
  const weekTotal = week.reduce((a, r) => a + r.guitar + r.piano, 0);
  const todayMin = Math.round(week[6].guitar + week[6].piano);
  const plan = practicePlan(data.goals.dailyMinutes);
  const empty = isEmptyLearner(data);
  const done = lessons.filter((l) => isDone(data.progress[l.id]));
  const mastered = lessons.filter((l) => data.progress[l.id]?.status === "mastered");
  const skillsMastered = Array.from(new Set(mastered.flatMap((l) => l.skills))).slice(0, 8);
  const weak = weakSkills(data.exercises.filter((e) => e.instrument === instrument || e.instrument === "theory"));
  const drills = data.drills.filter((d) => !d.untimed);
  const drillsThisWeek = drills.filter((d) => withinDays(d.date, 7)).length;
  const bestDrill = drills.reduce<(typeof drills)[number] | null>((b, d) => (!b || d.transitions > b.transitions ? d : b), null);
  const ach = achievements(data);
  const InstrumentIcon = instrument === "guitar" ? Guitar : Piano;
  const tone = instrument === "guitar" ? "guitar" : "piano";

  return (
    <div className="space-y-6">
      {/* Prominent instrument toggle */}
      <section aria-label="Instrument mode" className="hidden flex-col items-start gap-3 rounded-2xl sm:flex border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Instrument mode</p>
          <p className="text-sm text-muted">Lessons, tools and recommendations follow this choice. Progress is kept separately for each.</p>
        </div>
        <InstrumentToggle size="lg" className="w-full sm:w-auto" />
      </section>

      {hydrated && !prefs.onboarded && (
        <Callout tone="info" icon={<Sparkles className="h-5 w-5 text-piano" />} title="New here? Let's set up your learning plan">
          Answer a few quick questions (2 minutes) and we&apos;ll build a beginner plan around your time and music taste.{" "}
          <Link href="/onboarding" className="font-medium text-piano underline underline-offset-2">Start onboarding</Link>
        </Callout>
      )}

      <RevisionCard />

      {/* Greeting */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            {greeting()}
            {learnerName ? `, ${learnerName}` : ""}.
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
            <InstrumentIcon className={cn("h-4 w-4", instrument === "guitar" ? "text-guitar" : "text-piano")} aria-hidden />
            {instrument === "guitar" ? "Guitar" : "Piano"} · Level {level}: {LEVEL_NAMES[level]}
            <Badge tone={tone}>{done.length}/{lessons.length} lessons</Badge>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:flex">
          <Stat icon={<Flame className="h-4 w-4" />} label="Streak" value={loading ? "–" : `${streak} day${streak === 1 ? "" : "s"}`} />
          <Stat icon={<Clock className="h-4 w-4" />} label={`${instrument === "guitar" ? "Guitar" : "Piano"} time`} value={loading ? "–" : `${totalMinutes(instrSessions)} min`} />
          <Stat icon={<CalendarCheck className="h-4 w-4" />} label="Today" value={loading ? "–" : `${todayMin}/${data.goals.dailyMinutes} min`} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Continue learning */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className={cn("h-1.5", instrument === "guitar" ? "bg-guitar" : "bg-piano")} />
          <CardHeader icon={<PlayCircle className="h-5 w-5" />} title={inProgress ? "Continue learning" : "Recommended next lesson"} description={continueLesson ? `Level ${continueLesson.level} · ${LEVEL_NAMES[continueLesson.level]} · ~${continueLesson.minutes} min` : undefined} />
          <CardBody>
            {loading ? (
              <Skeleton className="h-20" />
            ) : continueLesson ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xl font-semibold">{continueLesson.title}</p>
                  <p className="mt-1 text-sm text-muted">{continueLesson.summary}</p>
                  {inProgress && (
                    <div className="mt-3 max-w-sm">
                      <ProgressBar value={inProgress.stepsDone.length / Math.max(1, continueLesson.steps.length)} tone={tone} label="Lesson progress" />
                      <p className="mt-1 text-xs text-muted">{inProgress.stepsDone.length} of {continueLesson.steps.length} steps</p>
                    </div>
                  )}
                  {next && inProgress && next.id !== continueLesson.id && (
                    <p className="mt-3 text-sm text-muted">
                      Up next: <Link className="font-medium text-text underline-offset-2 hover:underline" href={`/lesson/${next.id}`}>{next.title}</Link>
                    </p>
                  )}
                </div>
                <Link href={`/lesson/${continueLesson.id}`} className="shrink-0">
                  <Button size="lg">
                    {inProgress ? "Continue" : "Start lesson"} <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : LESSONS.length === 0 ? (
              <EmptyState icon={<BookOpen className="h-8 w-8" />} title="Lessons are loading" description="The curriculum couldn't be found." />
            ) : (
              <EmptyState icon={<Trophy className="h-8 w-8" />} title="You've completed every unlocked lesson!" description="Revise earlier lessons, practise songs, or switch instruments." action={<Link href="/learn"><Button variant="secondary">Browse curriculum</Button></Link>} />
            )}
          </CardBody>
        </Card>

        {/* Today's plan */}
        <Card>
          <CardHeader icon={<Target className="h-5 w-5" />} title="Today's practice plan" description={`${data.goals.dailyMinutes} minutes · short focused blocks`} action={<Link href="/settings#goals" className="text-xs text-muted hover:text-text">Edit</Link>} />
          <CardBody>
            <ol className="space-y-1.5">
              {plan.map((b, i) => {
                const href = planLink(b.kind, instrument, next?.id);
                const inner = (
                  <>
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", b.kind === "break" ? "bg-success-soft text-success" : "bg-surface-2 text-muted")}>{i + 1}</span>
                    <span className="flex-1 text-sm">{b.label}</span>
                    <span className="text-xs tabular-nums text-muted">{b.minutes} min</span>
                  </>
                );
                return (
                  <li key={i}>
                    {href ? (
                      <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">{inner}</Link>
                    ) : (
                      <div className="flex items-center gap-3 px-2 py-1.5">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-xs text-muted">Stop and rest if your hands, wrists or fingertips hurt. Little and often beats long sessions.</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<TrendingUp className="h-5 w-5" />}
            title="This week"
            description={empty ? "Your real practice will appear here." : `${Math.round(weekTotal)} minutes in the last 7 days`}
            action={empty ? <SourceTag source="sample" /> : <SourceTag source="measured" />}
          />
          <CardBody>
            <WeeklyChart data={empty ? SAMPLE_WEEK : week} />
            {empty && <p className="mt-2 text-xs text-muted">Sample data shown for illustration — it is not your progress. Practise in any lesson, lab or tool and time is logged automatically.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Award className="h-5 w-5" />} title="Skills" description="Mastered = passed measured exercises" />
          <CardBody className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Mastered</p>
              {skillsMastered.length ? (
                <div className="flex flex-wrap gap-1.5">{skillsMastered.map((s) => <Badge key={s} tone="success">{s}</Badge>)}</div>
              ) : (
                <p className="text-sm text-muted">None yet — finish a lesson&apos;s measured exercises to master its skills.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">To improve</p>
              {weak.length ? (
                <ul className="space-y-1.5">
                  {weak.slice(0, 4).map((w) => (
                    <li key={w.skill} className="flex items-center justify-between text-sm">
                      <span>{w.skill}</span>
                      <span className="tabular-nums text-muted">{Math.round(w.accuracy * 100)}% · {w.attempts} tries</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nothing flagged. Skills show up here when measured accuracy stays under 70%.</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader icon={<Clock className="h-5 w-5" />} title="Recent practice" action={<Link href="/practice/timer" className="text-xs text-muted hover:text-text">Timer</Link>} />
          <CardBody>
            {data.sessions.length ? (
              <ul className="divide-y divide-border">
                {data.sessions.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      {s.instrument === "guitar" ? <Guitar className="h-4 w-4 shrink-0 text-guitar" /> : <Piano className="h-4 w-4 shrink-0 text-piano" />}
                      <span className="truncate">{s.activity}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{Math.max(1, Math.round(s.durationSec / 60))} min · {new Date(s.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No sessions yet. Time is logged automatically while you practise.</p>
            )}
          </CardBody>
        </Card>

        {instrument === "guitar" ? (
          <Card>
            <CardHeader icon={<Guitar className="h-5 w-5" />} title="1-minute chord changes" action={<Link href="/practice/chord-drill" className="text-xs text-muted hover:text-text">Drill</Link>} />
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>This week</span>
                <span className="tabular-nums text-muted">{drillsThisWeek}/{data.goals.weeklyChordDrills} drills</span>
              </div>
              <ProgressBar value={drillsThisWeek / Math.max(1, data.goals.weeklyChordDrills)} tone="guitar" label="Weekly chord drill goal" />
              {bestDrill ? (
                <p className="text-sm">
                  Best: <strong>{bestDrill.transitions}</strong> changes on {bestDrill.pair.join("–")} <SourceTag source={bestDrill.mode === "self" ? "self-reported" : "measured"} />
                </p>
              ) : (
                <p className="text-sm text-muted">Try Em–Am first: two easy shapes, one minute.</p>
              )}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader icon={<Piano className="h-5 w-5" />} title="Keyboard practice" action={<Link href="/piano-lab" className="text-xs text-muted hover:text-text">Piano Lab</Link>} />
            <CardBody className="space-y-2 text-sm">
              <p>Measured piano exercises: <strong>{data.exercises.filter((e) => e.instrument === "piano" && e.measured).length}</strong></p>
              <p className="text-muted">Connect a MIDI keyboard in the Piano Lab for the most reliable note and timing feedback.</p>
            </CardBody>
          </Card>
        )}

        <NextSongCard instrument={instrument} />
      </div>

      <Card>
        <CardHeader icon={<Trophy className="h-5 w-5" />} title="Achievements & milestones" description={`${ach.filter((a) => a.earned).length} of ${ach.length} earned`} action={<Link href="/progress" className="text-xs text-muted hover:text-text">All progress</Link>} />
        <CardBody>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {ach.map((a) => (
              <li key={a.id} className={cn("flex items-start gap-3 rounded-xl border p-3", a.earned ? "border-transparent bg-accent-soft" : "border-border opacity-70")}>
                <Trophy className={cn("mt-0.5 h-4 w-4 shrink-0", a.earned ? "text-accent" : "text-subtle")} aria-hidden />
                <div>
                  <p className="text-sm font-medium">{a.title}<span className="sr-only">{a.earned ? " (earned)" : " (not yet earned)"}</span></p>
                  <p className="text-xs text-muted">{a.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 sm:min-w-28">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-subtle">{icon}{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums sm:text-lg">{value}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-20" />
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-48 lg:col-span-2" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
