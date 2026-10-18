"use client";
import { useT, useTx } from "@/lib/i18n";

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
  const tr = useT();
  const tx = useTx();
  const [active, setActive] = useState<ExId>("open-strings");
  const [scale, setScale] = useState<"c" | "em">("c");
  // Exercises pick random questions — render them only on the client to avoid hydration mismatches.
  const hydrated = useHydrated();

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <nav aria-label={tr("ui.guitar_exercises")} className="space-y-1">
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
              <span className="block text-sm font-medium">{tx(e.title)}</span>
              <span className="block text-xs text-muted">{tx(e.description)}</span>
            </span>
          </button>
        ))}
      </nav>
      <Card>
        <CardHeader icon={<Dumbbell className="h-5 w-5" />} title={tx(EXERCISES.find((e) => e.id === active)!.title)} description={tr("ui.results_are_saved_to_your_progress_measured_resu")} />
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
                  <p>{tr("ui.changing_chords_quickly_and_cleanly_is_the_skill")}</p>
                  <Link href="/practice/chord-drill"><Button>{tr("ui.open_the_chord_change_drill")} <ArrowRight className="h-4 w-4" /></Button></Link>
                </div>
              )}
              {active === "strumming" && <Strumming />}
              {active === "melody" && <SequenceExercise key="ode" id="guitar-melody-ode-to-joy" skill="melody" positions={ODE_TO_JOY} intro={tr("ui.beethoven_s_ode_to_joy_public_domain_on_the_top")} />}
              {active === "scales" && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button size="sm" variant={scale === "c" ? "primary" : "secondary"} onClick={() => setScale("c")}>{tr("ui.c_major_first_position")}</Button>
                    <Button size="sm" variant={scale === "em" ? "primary" : "secondary"} onClick={() => setScale("em")}>{tr("ui.e_minor_pentatonic_open")}</Button>
                  </div>
                  {scale === "c" ? (
                    <SequenceExercise key="c" id="guitar-scale-c-major" skill="scales" positions={C_MAJOR_FIRST_POSITION} intro={tr("ui.c_d_e_f_g_a_b_c_start_with_your_ring_finger_on_t")} step={0.5} />
                  ) : (
                    <SequenceExercise key="em" id="guitar-scale-e-minor-pentatonic" skill="scales" positions={E_MINOR_PENTATONIC_OPEN} intro={tr("ui.the_most_used_lead_guitar_scale_using_open_strin")} step={0.4} />
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
