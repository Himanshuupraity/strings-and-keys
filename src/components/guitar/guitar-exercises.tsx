"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Dumbbell } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Skeleton, cn } from "@/components/ui";
import { useHydrated } from "@/hooks/use-prefs";
import { OpenStringsQuiz } from "./exercises/open-strings-quiz";
import { FindNote } from "./exercises/find-note";
import { PlayOneString } from "./exercises/play-string";
import { ChordCheck } from "./exercises/chord-check";
import { Strumming } from "./exercises/strumming";
import { C_MAJOR_FIRST_POSITION, E_MINOR_PENTATONIC_OPEN, ODE_TO_JOY, SequenceExercise } from "./exercises/sequence-exercise";

const EXERCISES = [
  { id: "open-strings", title: "Memorise the open strings", description: "Name the highlighted string." },
  { id: "find-note", title: "Find notes on the fretboard", description: "Tap any position of a note." },
  { id: "single-string", title: "Play a single string cleanly", description: "Your mic checks the pitch." },
  { id: "open-chords", title: "Learn open chords", description: "Self-check + optional audio estimate." },
  { id: "switch", title: "Switch between two chords", description: "The 1-minute chord change drill." },
  { id: "strumming", title: "Strumming practice", description: "Tap along — timing is measured." },
  { id: "melody", title: "Play a simple melody", description: "Ode to Joy on two strings." },
  { id: "scales", title: "Practise scales", description: "C major & E minor pentatonic." },
] as const;

type ExId = (typeof EXERCISES)[number]["id"];

export function GuitarExercises() {
  const [active, setActive] = useState<ExId>("open-strings");
  const [scale, setScale] = useState<"c" | "em">("c");
  // Exercises pick random questions — render them only on the client to avoid hydration mismatches.
  const hydrated = useHydrated();

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <nav aria-label="Guitar exercises" className="space-y-1">
        {EXERCISES.map((e, i) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setActive(e.id)}
            aria-current={active === e.id ? "true" : undefined}
            className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors", active === e.id ? "bg-guitar-soft" : "hover:bg-surface-2")}
          >
            <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", active === e.id ? "bg-guitar text-white dark:text-black" : "bg-surface-3 text-muted")}>{i + 1}</span>
            <span>
              <span className="block text-sm font-medium">{e.title}</span>
              <span className="block text-xs text-muted">{e.description}</span>
            </span>
          </button>
        ))}
      </nav>
      <Card>
        <CardHeader icon={<Dumbbell className="h-5 w-5" />} title={EXERCISES.find((e) => e.id === active)!.title} description="Results are saved to your progress. Measured results come from the virtual neck, your taps, or the microphone." />
        <CardBody>
          {!hydrated ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              {active === "open-strings" && <OpenStringsQuiz />}
              {active === "find-note" && <FindNote />}
              {active === "single-string" && <PlayOneString />}
              {active === "open-chords" && <ChordCheck />}
              {active === "switch" && (
                <div className="space-y-3 text-sm">
                  <p>Changing chords quickly and cleanly is the skill that makes songs possible. The drill gives you 60 seconds to switch between two chords as many times as you can — cleanly.</p>
                  <Link href="/practice/chord-drill"><Button>Open the chord change drill <ArrowRight className="h-4 w-4" /></Button></Link>
                </div>
              )}
              {active === "strumming" && <Strumming />}
              {active === "melody" && <SequenceExercise key="ode" id="guitar-melody-ode-to-joy" skill="melody" positions={ODE_TO_JOY} intro="Beethoven's 'Ode to Joy' (public domain) on the top two strings. The orange dot shows the next note. Play it on the virtual neck, or turn on the mic and play your guitar." />}
              {active === "scales" && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button size="sm" variant={scale === "c" ? "primary" : "secondary"} onClick={() => setScale("c")}>C major (first position)</Button>
                    <Button size="sm" variant={scale === "em" ? "primary" : "secondary"} onClick={() => setScale("em")}>E minor pentatonic (open)</Button>
                  </div>
                  {scale === "c" ? (
                    <SequenceExercise key="c" id="guitar-scale-c-major" skill="scales" positions={C_MAJOR_FIRST_POSITION} intro="C D E F G A B C — start with your ring finger on the A string, 3rd fret. Go slowly and evenly." step={0.5} />
                  ) : (
                    <SequenceExercise key="em" id="guitar-scale-e-minor-pentatonic" skill="scales" positions={E_MINOR_PENTATONIC_OPEN} intro="The most-used lead guitar scale, using open strings. Two notes per string, low to high." step={0.4} />
                  )}
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
