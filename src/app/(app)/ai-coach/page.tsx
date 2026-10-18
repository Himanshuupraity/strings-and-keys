"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { LessonCoach } from "@/components/coach/lesson-coach";
import { CoachChat } from "@/components/coach/coach-chat";
import type { LastExercise } from "@/lib/coach/schema";

export default function AICoachPage() {
  const [lastExercise, setLastExercise] = useState<LastExercise | undefined>();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coach"
        title="Your patient practice teacher"
        description="I explain, play an example, listen while you try, and tell you exactly what happened — then we adjust the next step together."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <LessonCoach onResult={setLastExercise} />
        <CoachChat lastExercise={lastExercise} />
      </div>
      <p className="flex gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <strong className="text-text">What is measured vs. suggested:</strong> note names, pitch (cents), note order and chord tones come from your input (on-screen instrument, MIDI or microphone pitch detection) and are tagged “Measured”. Microphone chord detection is approximate and shows a confidence check. Coaching tips are suggestions — the app cannot see your hands, posture or finger pressure. Audio never leaves your device.
        </span>
      </p>
    </div>
  );
}
