"use client";

import { useT } from "@/lib/i18n";
import { useState } from "react";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { LessonCoach } from "@/components/coach/lesson-coach";
import { CoachChat } from "@/components/coach/coach-chat";
import type { LastExercise } from "@/lib/coach/schema";

export default function AICoachPage() {
  const t = useT();
  const [lastExercise, setLastExercise] = useState<LastExercise | undefined>();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav./ai-coach")}
        title={t("coach.title")}
        description={t("coach.desc")}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <LessonCoach onResult={setLastExercise} />
        <CoachChat lastExercise={lastExercise} />
      </div>
      <p className="flex gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <strong className="text-text">{t("coach.measuredTitle")}</strong> {t("coach.measuredBody")}
        </span>
      </p>
    </div>
  );
}
