"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Circle, CircleDot, Info, Medal, Target } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, PageHeader, ProgressBar, Segmented, Skeleton, SourceTag, cn } from "@/components/ui";
import { LESSONS, getLesson } from "@/content/curriculum";
import { LEVEL_NAMES, type Level } from "@/content/types";
import { MASTERY_EXPLANATION, isDone, nextLesson, practiceStreak, totalMinutes, weakSkills, weeklyMinutes } from "@/lib/progress/engine";
import type { Track } from "@/lib/storage/schemas";
import { usePrefs, useHydrated } from "@/hooks/use-prefs";
import { useData } from "@/hooks/use-data";
import { quizRepo } from "@/lib/storage/repositories";
import { useLearnerData } from "@/components/dashboard/learner-data";
import { WeeklyChart } from "@/components/dashboard/weekly-chart";

const TRACKS: { track: Track; label: string; tone: "theory" | "guitar" | "piano" }[] = [
  { track: "theory", label: "Music theory", tone: "theory" },
  { track: "guitar", label: "Guitar", tone: "guitar" },
  { track: "piano", label: "Piano", tone: "piano" },
];

export function ProgressView() {
  const [prefs] = usePrefs();
  const { data, loading } = useLearnerData();
  const quizzes = useData(() => quizRepo.list(), ["quizAttempts"], []);
  const [track, setTrack] = useState<Track>(prefs.instrument);
  const next = nextLesson(LESSONS, data.progress, [prefs.instrument, "theory"], data.profile?.placement);
  const week = weeklyMinutes(data.sessions);
  const weak = weakSkills(data.exercises);
  const measured = data.exercises.filter((e) => e.measured);

  const drills = data.drills;
  const pairs = useMemo(() => {
    const m = new Map<string, typeof drills>();
    for (const d of drills.filter((x) => !x.untimed)) {
      const k = d.pair.join("–");
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [drills]);
  const [pairSel, setPairSel] = useState<string | null>(null);
  const hydrated = useHydrated();
  if (!hydrated) return <Skeleton className="h-96" />;
  const activePair = pairSel ?? pairs[0]?.[0] ?? null;
  const pairRows = (pairs.find((p) => p[0] === activePair)?.[1] ?? [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d, i) => ({ n: i + 1, date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), transitions: d.transitions, mode: d.mode }));

  const trackLessons = LESSONS.filter((l) => l.track === track);
  const levels = Array.from(new Set(trackLessons.map((l) => l.level))).sort() as Level[];

  return (
    <div>
      <PageHeader eyebrow="Progress" title="Your progress" description="Lesson completion and demonstrated proficiency are tracked separately — and separately for guitar, piano and shared theory." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TRACKS.map((t) => {
          const ls = LESSONS.filter((l) => l.track === t.track);
          const done = ls.filter((l) => isDone(data.progress[l.id])).length;
          const mastered = ls.filter((l) => data.progress[l.id]?.status === "mastered").length;
          return (
            <Card key={t.track} className="p-4">
              <p className="text-sm font-medium">{t.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "–" : `${done}/${ls.length}`}</p>
              <p className="mb-2 text-xs text-muted">completed · {mastered} mastered</p>
              <ProgressBar value={ls.length ? done / ls.length : 0} tone={t.tone} label={`${t.label} completion`} />
            </Card>
          );
        })}
        <Card className="p-4">
          <p className="text-sm font-medium">Practice</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalMinutes(data.sessions)} min</p>
          <p className="text-xs text-muted">{practiceStreak(data.sessions)}-day streak · {data.sessions.length} sessions</p>
          <p className="mt-2 text-xs text-muted">Guitar {totalMinutes(data.sessions, "guitar")} · Piano {totalMinutes(data.sessions, "piano")} min</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={<Target className="h-5 w-5" />} title="Next best step" />
          <CardBody>
            {next ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{next.title}</p>
                  <p className="text-sm text-muted">Level {next.level} · {LEVEL_NAMES[next.level]} — {next.summary}</p>
                </div>
                <Link href={`/lesson/${next.id}`} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover">Open lesson</Link>
              </div>
            ) : (
              <p className="text-sm text-muted">All unlocked lessons are complete. Revise, practise songs or try the other instrument.</p>
            )}
            {weak.length > 0 && (
              <div className="mt-4 rounded-xl bg-warn-soft p-3 text-sm">
                <p className="font-medium">Areas needing revision</p>
                <ul className="mt-1 list-inside list-disc text-muted">
                  {weak.slice(0, 4).map((w) => (
                    <li key={w.skill}>{w.skill}: {Math.round(w.accuracy * 100)}% average over {w.attempts} measured attempts</li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Info className="h-5 w-5" />} title="How mastery works" />
          <CardBody>
            <ul className="space-y-2 text-sm text-muted">
              {MASTERY_EXPLANATION.map((m) => (
                <li key={m} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{m}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Weekly report" description={`${Math.round(week.reduce((a, r) => a + r.guitar + r.piano, 0))} minutes in the last 7 days · ${week.filter((r) => r.guitar + r.piano > 0).length}/${data.goals.weeklyPracticeDays} practice-day goal`} action={<SourceTag source="measured" />} />
        <CardBody><WeeklyChart data={week} /></CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Lessons"
          description="Status per lesson. Open any completed lesson to revise."
          action={<Segmented<Track> label="Track" size="sm" value={track} onChange={setTrack} options={TRACKS.map((t) => ({ value: t.track, label: t.label }))} />}
        />
        <CardBody className="space-y-5">
          {loading && <Skeleton className="h-40" />}
          {!loading && trackLessons.length === 0 && <p className="text-sm text-muted">No lessons in this track yet.</p>}
          {levels.map((lv) => {
            const ls = trackLessons.filter((l) => l.level === lv);
            const done = ls.filter((l) => isDone(data.progress[l.id])).length;
            return (
              <div key={lv}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Level {lv} · {LEVEL_NAMES[lv]}</p>
                  <span className="text-xs text-muted">{done}/{ls.length} {done === ls.length ? "· level complete" : ""}</span>
                </div>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {ls.map((l) => {
                    const p = data.progress[l.id];
                    const st = p?.status ?? "not-started";
                    return (
                      <li key={l.id}>
                        <Link href={`/lesson/${l.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                          {st === "mastered" ? <Medal className="h-4 w-4 text-accent" /> : st === "completed" ? <CheckCircle2 className="h-4 w-4 text-success" /> : st === "in-progress" ? <CircleDot className="h-4 w-4 text-piano" /> : <Circle className="h-4 w-4 text-subtle" />}
                          <span className="flex-1 truncate">{l.title}</span>
                          {p?.quizBest != null && <span className="text-xs tabular-nums text-muted">quiz {Math.round(p.quizBest * 100)}%</span>}
                          <span className="sr-only">{st}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Chord change drill history" description="Transitions per minute over time" />
          <CardBody>
            {pairs.length === 0 ? (
              <p className="text-sm text-muted">No timed drills yet. <Link href="/practice/chord-drill" className="underline">Try the 1-minute drill</Link>.</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {pairs.map(([k, rows]) => (
                    <button key={k} type="button" onClick={() => setPairSel(k)} aria-pressed={k === activePair} className={cn("rounded-full border px-2.5 py-1 text-xs", k === activePair ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2")}>
                      {k} · best {Math.max(...rows.map((r) => r.transitions))}
                    </button>
                  ))}
                </div>
                <div style={{ height: 200 }} role="img" aria-label={`${activePair} drill results: ${pairRows.map((r) => `${r.date} ${r.transitions}`).join(", ")}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pairRows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} width={44} />
                      <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }} formatter={(v) => [`${v} changes`, activePair]} />
                      <Line type="monotone" dataKey="transitions" stroke="var(--chart-guitar)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-guitar)" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-muted">Self-reported drills count your own taps; audio-assisted drills count only confidently detected changes.</p>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent exercise results" description="Measured = checked from the virtual instrument, MIDI or microphone" />
          <CardBody>
            {data.exercises.length === 0 ? (
              <p className="text-sm text-muted">No exercise results yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.exercises.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 truncate">{e.lessonId ? getLesson(e.lessonId)?.title ?? e.exerciseId : e.exerciseId}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-muted">{Math.round(e.accuracy * 100)}%</span>
                      <Badge tone="neutral">{e.input}</Badge>
                      <SourceTag source={e.measured ? "measured" : "self-reported"} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">{measured.length} measured results in total. Scores show what was checked, not your overall musicianship.</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Quiz attempts" />
        <CardBody>
          {quizzes.data.length === 0 ? (
            <p className="text-sm text-muted">No quizzes taken yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {quizzes.data.slice(0, 10).map((q) => (
                <li key={q.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">{getLesson(q.lessonId)?.title ?? q.lessonId}</span>
                  <span className="text-muted tabular-nums">{q.score}/{q.total} · {new Date(q.date).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
