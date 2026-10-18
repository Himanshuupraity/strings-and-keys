"use client";

import Link from "next/link";
import { ArrowRight, AudioLines, Ear, Gauge, Guitar, Hand, Music2, Piano, Repeat2, Sparkles, Timer, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePrefs } from "@/hooks/use-prefs";
import { useData } from "@/hooks/use-data";
import { practiceRepo } from "@/lib/storage/repositories";
import { dayKey, practiceStreak } from "@/lib/progress/engine";
import type { PracticeSession } from "@/lib/storage/schemas";
import { Badge, Card, cn } from "@/components/ui";

interface Tool {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  for: ("guitar" | "piano")[];
  needs?: string;
}

const TOOLS: Tool[] = [
  { href: "/tuner", title: "Guitar tuner", description: "Tune each string with your microphone — needle, cents and plain advice.", icon: Gauge, for: ["guitar"], needs: "Microphone" },
  { href: "/practice/chord-drill", title: "1-Minute Chord Change drill", description: "Switch between two chords for 60 seconds and beat your best score.", icon: Repeat2, for: ["guitar"] },
  { href: "/practice/metronome", title: "Metronome", description: "40–240 BPM, time signatures, accents and tap tempo.", icon: Timer, for: ["guitar", "piano"] },
  { href: "/practice/chord-trainer", title: "Chord trainer", description: "Play a chord and see which notes are missing or extra.", icon: Music2, for: ["guitar", "piano"], needs: "Mic or MIDI" },
  { href: "/practice/scale-trainer", title: "Scale trainer", description: "Play scales note by note, then speed up gradually.", icon: AudioLines, for: ["guitar", "piano"] },
  { href: "/practice/rhythm", title: "Rhythm trainer", description: "Tap along to patterns; see early and late hits.", icon: Hand, for: ["guitar", "piano"] },
  { href: "/practice/ear-training", title: "Ear-training lab", description: "High/low, intervals, major vs minor, melodies and swaras.", icon: Ear, for: ["guitar", "piano"] },
  { href: "/practice/note-detector", title: "Piano note detector", description: "Play one note on a real piano and check it.", icon: Waves, for: ["piano"], needs: "Mic or MIDI" },
  { href: "/practice/timer", title: "Practice timer", description: "Time and save sessions; daily and weekly stats.", icon: Timer, for: ["guitar", "piano"] },
  { href: "/piano-lab", title: "Piano Lab", description: "Full playable keyboard (49/61/88 keys) with guided exercises.", icon: Piano, for: ["piano"] },
  { href: "/guitar-lab", title: "Guitar Lab", description: "Fretboard, chords, scales, capo simulator and transposer.", icon: Guitar, for: ["guitar"] },
];

export function PracticeHub() {
  const [prefs] = usePrefs();
  const { data: sessions } = useData(() => practiceRepo.list(), ["practiceSessions"], [] as PracticeSession[]);
  const todayMin = Math.round(sessions.filter((s) => dayKey(s.startedAt) === dayKey(new Date())).reduce((a, s) => a + s.durationSec, 0) / 60);
  const streak = practiceStreak(sessions);
  const recommended = prefs.instrument === "guitar" ? TOOLS[1] : TOOLS[4];
  const ordered = [...TOOLS].sort((a, b) => Number(b.for.includes(prefs.instrument)) - Number(a.for.includes(prefs.instrument)));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <Link href={recommended.href} className="group">
          <Card className={cn("flex h-full items-center gap-4 p-5 transition-colors group-hover:border-accent", prefs.instrument === "guitar" ? "bg-guitar-soft" : "bg-piano-soft")}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent"><Sparkles className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Recommended for {prefs.instrument}</p>
              <p className="text-lg font-semibold">{recommended.title}</p>
              <p className="text-sm text-muted">{recommended.description}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted transition-transform group-hover:translate-x-1" />
          </Card>
        </Link>
        <Card className="flex items-center gap-6 px-6 py-4">
          <div><p className="text-xs text-muted">Today</p><p className="text-2xl font-semibold" data-testid="today-minutes">{todayMin} min</p></div>
          <div><p className="text-xs text-muted">Streak</p><p className="text-2xl font-semibold">{streak} d</p></div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map((t) => {
          const Icon = t.icon;
          const relevant = t.for.includes(prefs.instrument);
          return (
            <Link key={t.href} href={t.href} className="group">
              <Card className={cn("flex h-full flex-col gap-3 p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-accent", !relevant && "opacity-80")}>
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-accent"><Icon className="h-5 w-5" /></div>
                  <div className="flex gap-1">
                    {t.for.length === 1 && <Badge tone={t.for[0]}>{t.for[0]}</Badge>}
                    {t.needs && <Badge>{t.needs}</Badge>}
                  </div>
                </div>
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className="mt-1 text-sm text-muted">{t.description}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
