"use client";
import { useT, useTx } from "@/lib/i18n";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Coffee, Flame, HeartPulse, Pause, Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePrefs } from "@/hooks/use-prefs";
import { useData } from "@/hooks/use-data";
import { Badge, Button, Callout, Card, CardBody, CardHeader, EmptyState, Input, Segmented, Select, Skeleton } from "@/components/ui";
import { practiceRepo } from "@/lib/storage/repositories";
import { dayKey, practiceStreak, totalMinutes, weeklyMinutes } from "@/lib/progress/engine";
import { LESSONS } from "@/content/curriculum";
import type { Instrument, PracticeSession } from "@/lib/storage/schemas";
import { IDLE_TIMER, elapsedMs, formatDuration, pauseTimer, resumeTimer, startTimer, type TimerState } from "./logic/timer";

const KEY = "mm:practice-timer";
const ACTIVITIES = ["Free practice", "Lesson", "Chords", "Scales", "Song practice", "Technique / warm-up", "Ear training", "Reading music"];
const BREAK_EVERY_MS = 25 * 60 * 1000;

function loadTimer(): { t: TimerState; instrument?: Instrument; activity?: string; lessonId?: string } | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function PracticeTimer() {
  const tr = useT();
  const tx = useTx();
  const [prefs] = usePrefs();
  const [t, setT] = useState<TimerState>(IDLE_TIMER);
  const [instrument, setInstrument] = useState<Instrument>(prefs.instrument);
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const [lessonId, setLessonId] = useState("");
  const [notes, setNotes] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const breaksShown = useRef(0);
  const { data: sessions, loading } = useData(() => practiceRepo.list(), ["practiceSessions"], [] as PracticeSession[]);

  // Restore a running timer after reload. localStorage is only readable after mount.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = loadTimer();
    if (saved?.t?.status && saved.t.status !== "idle") {
      setT(saved.t);
      if (saved.instrument) setInstrument(saved.instrument);
      if (saved.activity) setActivity(saved.activity);
      if (saved.lessonId) setLessonId(saved.lessonId);
    } else setInstrument(prefs.instrument);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      if (t.status === "idle") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify({ t, instrument, activity, lessonId }));
    } catch {
      /* ignore */
    }
  }, [t, instrument, activity, lessonId]);

  useEffect(() => {
    if (t.status !== "running") return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      const due = Math.floor(elapsedMs(t, n) / BREAK_EVERY_MS);
      if (due > breaksShown.current) {
        breaksShown.current = due;
        toast(tr("ui.time_for_a_short_break"), { description: tr("ui.you_ve_practised_for_25_minutes_stretch_your_han"), duration: 12000 });
      }
    }, 500);
    return () => clearInterval(id);
  }, [t, tr]);

  const elapsed = elapsedMs(t, now);

  const end = async () => {
    const endNow = Date.now();
    const ms = elapsedMs(t, endNow);
    setT(IDLE_TIMER);
    breaksShown.current = 0;
    if (ms < 30_000) {
      toast.info(tr("ui.session_shorter_than_30_seconds_not_saved"));
      return;
    }
    await practiceRepo.add({ instrument, activity: activity === "Lesson" && lessonId ? `Lesson: ${LESSONS.find((l) => l.id === lessonId)?.title ?? lessonId}` : activity, lessonId: lessonId || undefined, startedAt: new Date(t.startedAt ?? endNow - ms).toISOString(), endedAt: new Date(endNow).toISOString(), durationSec: Math.round(ms / 1000), notes: notes.trim() || undefined });
    setNotes("");
    toast.success(`Saved ${formatDuration(ms)} of ${instrument} practice.`);
  };

  const week = useMemo(() => weeklyMinutes(sessions), [sessions]);
  const today = useMemo(() => sessions.filter((s) => dayKey(s.startedAt) === dayKey(new Date())).reduce((a, s) => a + s.durationSec, 0) / 60, [sessions]);
  const streak = practiceStreak(sessions);
  const weekTotal = week.reduce((a, d) => a + d.guitar + d.piano, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardBody className="flex flex-col items-center gap-5 py-8">
            <div className="font-display text-7xl tabular-nums sm:text-8xl" aria-live="off" data-testid="timer-display">{formatDuration(elapsed)}</div>
            <Badge tone={t.status === "running" ? "success" : t.status === "paused" ? "warn" : "neutral"}>{t.status === "running" ? "Practising" : t.status === "paused" ? "Paused" : "Ready"}</Badge>
            <div className="flex flex-wrap justify-center gap-2">
              {t.status === "idle" && <Button size="lg" onClick={() => { const n = Date.now(); setNow(n); setT(startTimer(n)); }} data-testid="timer-start"><Play className="h-5 w-5" /> {tr("ui.start_session")}</Button>}
              {t.status === "running" && <Button size="lg" variant="secondary" onClick={() => setT(pauseTimer(t, Date.now()))}><Pause className="h-5 w-5" /> {tr("sheet.pause")}</Button>}
              {t.status === "paused" && <Button size="lg" onClick={() => { const n = Date.now(); setNow(n); setT(resumeTimer(t, n)); }}><Play className="h-5 w-5" /> {tr("ui.resume")}</Button>}
              {t.status !== "idle" && <Button size="lg" variant="outline" onClick={() => void end()} data-testid="timer-end"><Square className="h-5 w-5" /> {tr("ui.end_save")}</Button>}
            </div>
            <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-sm font-medium">{tr("ui.instrument")}</span>
                <Segmented label={tr("ui.instrument")} value={instrument} onChange={setInstrument} className="w-full" options={[{ value: "guitar", label: tr("shell.guitar") }, { value: "piano", label: tr("shell.piano") }]} />
              </div>
              <div className="space-y-1">
                <label htmlFor="timer-activity" className="text-sm font-medium">{tr("ui.activity")}</label>
                <Select id="timer-activity" className="w-full" value={activity} onChange={(e) => setActivity(e.target.value)}>
                  {ACTIVITIES.map((a) => <option key={a} value={a}>{tx(a)}</option>)}
                </Select>
              </div>
              {activity === "Lesson" && (
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="timer-lesson" className="text-sm font-medium">{tr("ui.lesson_optional")}</label>
                  <Select id="timer-lesson" className="w-full" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
                    <option value="">—</option>
                    {LESSONS.filter((l) => l.track === instrument || l.track === "theory").map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </Select>
                </div>
              )}
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="timer-notes" className="text-sm font-medium">{tr("ui.notes_optional")}</label>
                <Input id="timer-notes" value={notes} maxLength={200} placeholder={tr("ui.e_g_g_to_c_change_is_getting_smoother")} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            <Stat label={tr("dash.today")} value={`${Math.round(today)} min`} />
            <Stat label={tr("dash.thisWeek")} value={tr("common.min", { n: Math.round(weekTotal) })} />
            <Stat label={tr("dash.streak")} value={<span className="inline-flex items-center gap-1"><Flame className="h-5 w-5 text-accent" />{streak} day{streak === 1 ? "" : "s"}</span>} />
          </div>
          <Callout tone="warn" icon={<HeartPulse className="h-4 w-4" />} title={tr("ui.practise_safely")}>
            {tr("ui.short_regular_sessions_work_best_take_a_break_ev")}
          </Callout>
          <Callout icon={<Coffee className="h-4 w-4" />} title={tr("ui.break_reminder")}>{tr("ui.we_ll_nudge_you_every_25_minutes_while_the_timer")}</Callout>
        </div>
      </div>

      <Card>
        <CardHeader title={tr("ui.last_7_days")} description={tr("ui.last7_split", { g: totalMinutes(sessions, "guitar"), p: totalMinutes(sessions, "piano") })} />
        <CardBody>
          {loading ? <Skeleton className="h-56" /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={week} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} unit="m" allowDecimals={false} />
                  <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="guitar" name={tr("shell.guitar")} stackId="a" fill="var(--guitar)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="piano" name={tr("shell.piano")} stackId="a" fill="var(--piano)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={tr("ui.history")} />
        <CardBody>
          {loading ? <Skeleton className="h-24" /> : sessions.length === 0 ? (
            <EmptyState title={tr("ui.no_practice_sessions_yet")} description={tr("ui.start_the_timer_above_time_spent_in_lessons_and")} />
          ) : (
            <ul className="divide-y divide-border" data-testid="session-history">
              {sessions.slice(0, 50).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tx(s.activity)}</p>
                    <p className="text-xs text-muted">{new Date(s.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{s.notes ? ` · ${s.notes}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={s.instrument}>{s.instrument}</Badge>
                    <span className="w-14 text-right text-sm tabular-nums">{formatDuration(s.durationSec * 1000)}</span>
                    <Button size="icon" variant="ghost" className="h-10 w-10 sm:h-8 sm:w-8" aria-label={`Delete session ${s.activity}`} onClick={() => void practiceRepo.remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </Card>
  );
}
